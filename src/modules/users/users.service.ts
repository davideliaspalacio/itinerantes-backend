import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { currencyForCountry } from '../../common/utils/money';
import { Prisma, User, UserStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { normalizeEmail, normalizeUsername } from '../auth/auth.policy';
import { LocationsService } from '../locations/locations.service';
import type { UpdateProfileRequestDto } from './dto/update-profile.request.dto';
import type { UserProfileDto } from './dto/user-profile.response.dto';
import type { LocationInputDto, PhoneDto } from './dto/user-fields';

type UserWithCountry = User & { country: { name: string } };

export interface CreateUserInput {
  fullName: string;
  username: string;
  email: string;
  passwordHash: string;
  phone: PhoneDto;
  location: LocationInputDto;
  timezone: string;
}

/**
 * Usuarios y perfil (HU-02 datos, HU-14). La autenticación (OTP, tokens) vive en AuthModule.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locations: LocationsService,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async availability(
    email?: string,
    username?: string,
  ): Promise<{ email?: boolean; username?: boolean }> {
    const [emailTaken, usernameTaken] = await Promise.all([
      email ? this.prisma.user.count({ where: { email: normalizeEmail(email) } }) : undefined,
      username
        ? this.prisma.user.count({ where: { username: normalizeUsername(username) } })
        : undefined,
    ]);
    return {
      ...(email !== undefined ? { email: emailTaken === 0 } : {}),
      ...(username !== undefined ? { username: usernameTaken === 0 } : {}),
    };
  }

  /** Crea la cuenta "pendiente de verificación" (HU-02). Valida unicidad, ubicación y teléfono. */
  async create(input: CreateUserInput): Promise<User> {
    const [emailTaken, usernameTaken] = await Promise.all([
      this.prisma.user.count({ where: { email: input.email } }),
      this.prisma.user.count({ where: { username: input.username } }),
    ]);
    if (emailTaken || usernameTaken) {
      const details = [
        ...(emailTaken
          ? [
              {
                field: 'email',
                code: 'ALREADY_EXISTS',
                message: 'Ya existe una cuenta con este correo.',
              },
            ]
          : []),
        ...(usernameTaken
          ? [
              {
                field: 'username',
                code: 'ALREADY_EXISTS',
                message: 'Ese nombre de usuario ya está en uso.',
              },
            ]
          : []),
      ];
      throw new AppException(emailTaken ? 'AUTH_EMAIL_ALREADY_REGISTERED' : 'AUTH_USERNAME_TAKEN', {
        details,
      });
    }

    const location = await this.locations.resolveLocation(input.location);
    await this.locations.validatePhone(input.phone);

    return this.prisma.user.create({
      data: {
        fullName: input.fullName,
        username: input.username,
        email: input.email,
        passwordHash: input.passwordHash,
        phoneCountryCode: input.phone.countryCode,
        phoneNumber: input.phone.number,
        ...location,
        timezone: input.timezone,
        status: UserStatus.PENDING_VERIFICATION,
      },
    });
  }

  async getProfile(userId: string): Promise<UserProfileDto> {
    return toUserProfile(await this.requireActiveWithCountry(userId));
  }

  /** HU-14 "Datos personales": username y correo no se aceptan (el DTO los rechaza). */
  async updateProfile(userId: string, dto: UpdateProfileRequestDto): Promise<UserProfileDto> {
    await this.requireActiveWithCountry(userId);
    const data: Prisma.UserUncheckedUpdateInput = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    if (dto.phone) {
      await this.locations.validatePhone(dto.phone);
      data.phoneCountryCode = dto.phone.countryCode;
      data.phoneNumber = dto.phone.number;
    }
    if (dto.location) {
      Object.assign(data, await this.locations.resolveLocation(dto.location));
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      include: { country: { select: { name: true } } },
    });
    return toUserProfile(user);
  }

  async updateTimezone(userId: string, timezone: string): Promise<UserProfileDto> {
    await this.requireActiveWithCountry(userId);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { timezone },
      include: { country: { select: { name: true } } },
    });
    return toUserProfile(user);
  }

  async toProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { country: { select: { name: true } } },
    });
    return toUserProfile(user);
  }

  /** Token válido pero usuario inexistente o deshabilitado → 401 (fuerza re-login). */
  private async requireActiveWithCountry(userId: string): Promise<UserWithCountry> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { country: { select: { name: true } } },
    });
    if (!user || user.status !== UserStatus.ACTIVE) throw new AppException('UNAUTHORIZED');
    return user;
  }
}

export function toUserProfile(user: UserWithCountry): UserProfileDto {
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    phone: { countryCode: user.phoneCountryCode, number: user.phoneNumber },
    location: {
      countryCode: user.countryCode,
      countryName: user.country.name,
      divisionId: user.divisionId,
      divisionName: user.divisionName,
      municipalityId: user.municipalityId,
      municipalityName: user.municipalityName,
    },
    timezone: user.timezone,
    currency: currencyForCountry(user.countryCode),
    roles: user.roles,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
