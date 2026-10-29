import { Injectable } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import { paginate, type PaginatedResponseDto } from '../../../common/dto/pagination.dto';
import type { AdminUser } from '../../../common/guards/permissions.guard';
import { nowUtc } from '../../../common/utils/time';
import { permissionsForRoles, ROLE_PERMISSIONS, STAFF_ROLES } from '../../../config/permissions';
import type { Prisma, Role, User } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { MoodleAccessService } from '../../moodle/moodle-access.service';
import {
  type AdminMeDto,
  type AdminUserDto,
  type ListAdminUsersQueryDto,
  ROLE_LABELS,
  type RolesCatalogDto,
} from './dto/admin-users.dto';
import { normalizeRoles, staffChangeIssue } from './policies/staff-access.policy';

/**
 * Cuentas del equipo (Fase 06). No hay alta de cuentas desde el panel: la persona se registra en el
 * portal (HU-02/03) y un SUPER_ADMIN le asigna roles aquí (y, si no le llegó el código, puede marcar
 * su correo como verificado). El primer SUPER_ADMIN se crea con
 * BOOTSTRAP_ADMIN_* o `pnpm admin:create` (docs/DEPLOY.md).
 */
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly moodle: MoodleAccessService,
  ) {}

  async me(user: AdminUser): Promise<AdminMeDto> {
    const row = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { id: true, email: true, fullName: true, roles: true },
    });
    return {
      user: { id: row.id, email: row.email, fullName: row.fullName },
      roles: row.roles,
      permissions: permissionsForRoles(row.roles),
    };
  }

  roles(): RolesCatalogDto {
    return {
      data: (['PARTICIPANT', ...STAFF_ROLES] as Role[]).map((role) => ({
        role,
        label: ROLE_LABELS[role],
        permissions: [...ROLE_PERMISSIONS[role]],
      })),
    };
  }

  async list(query: ListAdminUsersQueryDto): Promise<PaginatedResponseDto<AdminUserDto>> {
    const q = query.q?.trim();
    const where: Prisma.UserWhereInput = {
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q.toLowerCase() } },
              { username: { contains: q.toLowerCase() } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.role ? { roles: { has: query.role } } : {}),
      ...(query.staffOnly ? { roles: { hasSome: [...STAFF_ROLES] } } : {}),
    };
    const orderBy: Prisma.UserOrderByWithRelationInput[] =
      query.sort === 'CREATED_DESC'
        ? [{ createdAt: 'desc' }]
        : query.sort === 'LAST_LOGIN_DESC'
          ? [{ lastLoginAt: { sort: 'desc', nulls: 'last' } }]
          : [{ fullName: 'asc' }];
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: [...orderBy, { id: 'asc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(rows.map(toDto), total, query);
  }

  async updateRoles(actor: AdminUser, userId: string, roles: Role[]): Promise<AdminUserDto> {
    const nextRoles = normalizeRoles(roles);
    return this.change(
      actor,
      userId,
      { roles: nextRoles },
      'user.update-roles',
      (u) =>
        `Cambió los roles de ${u.email}: ${nextRoles.filter((r) => r !== 'PARTICIPANT').join(', ') || 'sin roles del equipo'}.`,
    );
  }

  async disable(actor: AdminUser, userId: string, reason?: string): Promise<AdminUserDto> {
    return this.change(
      actor,
      userId,
      { status: 'DISABLED' },
      'user.disable',
      (u) => `Deshabilitó la cuenta ${u.email}${reason ? `: ${reason}` : '.'}`,
      reason,
    );
  }

  async enable(actor: AdminUser, userId: string, reason?: string): Promise<AdminUserDto> {
    const target = await this.require(userId);
    const status = target.emailVerifiedAt ? 'ACTIVE' : 'PENDING_VERIFICATION';
    return this.change(
      actor,
      userId,
      { status },
      'user.enable',
      (u) => `Habilitó la cuenta ${u.email}${reason ? `: ${reason}` : '.'}`,
      reason,
    );
  }

  /**
   * Marca el correo como verificado sin OTP (cuentas del equipo a las que no les llega el código).
   * PENDING_VERIFICATION → ACTIVE; una cuenta DISABLED sigue deshabilitada. Invalida los códigos de
   * verificación pendientes y vincula la formación Moodle igual que `POST /auth/verify-email`.
   */
  async verifyEmail(actor: AdminUser, userId: string, reason?: string): Promise<AdminUserDto> {
    const now = nowUtc();
    const saved = await this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: userId } });
      if (!target) throw AppException.notFound('La cuenta no existe.');
      if (target.emailVerifiedAt) {
        throw new AppException('AUTH_ALREADY_VERIFIED', {
          message: 'El correo de esta cuenta ya está verificado.',
        });
      }
      const status = target.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE';
      const updated = await tx.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: now, status },
      });
      await tx.otpCode.updateMany({
        where: { userId, purpose: 'EMAIL_VERIFICATION', consumedAt: null },
        data: { consumedAt: now },
      });
      await this.audit.record(
        {
          actor,
          action: 'user.verify-email',
          entityType: 'User',
          entityId: userId,
          summary: `Verificó manualmente el correo de ${target.email}${reason ? `: ${reason}` : '.'}`,
          before: { status: target.status, emailVerifiedAt: null },
          after: {
            status: updated.status,
            emailVerifiedAt: now.toISOString(),
            ...(reason ? { reason } : {}),
          },
        },
        tx,
      );
      return updated;
    });
    // HU-25: igual que la verificación por OTP (best effort, nunca falla).
    await this.moodle.linkAfterVerification(userId);
    return toDto(saved);
  }

  // ------------------------------------------------------------------------------------------------

  /** Aplica el cambio con las reglas (sin auto-bloqueo, siempre un SUPER_ADMIN) de forma atómica. */
  private async change(
    actor: AdminUser,
    userId: string,
    data: { roles?: Role[]; status?: User['status'] },
    action: string,
    summary: (user: User) => string,
    reason?: string,
  ): Promise<AdminUserDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      // Serializa los cambios de cuentas SUPER_ADMIN para que dos bajas simultáneas no dejen 0.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext('admin-staff-change'))`;
      const target = await tx.user.findUnique({ where: { id: userId } });
      if (!target) throw AppException.notFound('La cuenta no existe.');
      const activeSuperAdmins = await tx.user.count({
        where: { status: 'ACTIVE', roles: { has: 'SUPER_ADMIN' } },
      });
      const nextRoles = data.roles ?? target.roles;
      const nextStatus = data.status ?? target.status;
      const issue = staffChangeIssue({
        actorId: actor.id,
        targetId: target.id,
        currentRoles: target.roles,
        currentlyActive: target.status === 'ACTIVE',
        nextRoles,
        nextActive: nextStatus === 'ACTIVE',
        activeSuperAdmins,
      });
      if (issue) throw new AppException(issue);
      const saved = await tx.user.update({ where: { id: userId }, data });
      if (nextStatus === 'DISABLED') {
        // Cierra todas sus sesiones (los access tokens vigentes ya no pasan el PermissionsGuard).
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: nowUtc() },
        });
      }
      await this.audit.record(
        {
          actor,
          action,
          entityType: 'User',
          entityId: userId,
          summary: summary(saved),
          before: { roles: target.roles, status: target.status },
          after: { roles: saved.roles, status: saved.status, ...(reason ? { reason } : {}) },
        },
        tx,
      );
      return saved;
    });
    return toDto(updated);
  }

  private async require(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppException.notFound('La cuenta no existe.');
    return user;
  }
}

function toDto(user: User): AdminUserDto {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    username: user.username,
    roles: user.roles,
    permissions: permissionsForRoles(user.roles),
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    countryCode: user.countryCode,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
