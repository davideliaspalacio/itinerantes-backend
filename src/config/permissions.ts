import type { Role } from '../generated/prisma/client';

/**
 * Permisos del panel administrativo (Fase 06, HU-27 a HU-33) y matriz rol → permisos.
 *
 * ÚNICO lugar donde se decide qué puede hacer cada rol: los endpoints declaran el permiso que
 * necesitan con `@RequirePermissions(...)` y `PermissionsGuard` lo resuelve con esta matriz. Si el
 * cliente pide otro reparto (Anexo A, HU-31: "confirmar si el comité requiere..."), se cambia aquí.
 *
 * Los permisos son estables (el frontend los usa para mostrar/ocultar botones con `GET /admin/me`).
 */
export const Permission = {
  /** Entrar al panel (cualquier rol del equipo). */
  ADMIN_ACCESS: 'admin.access',

  /** HU-27/28/29: ver ofertas, docentes, módulos, recursos, sesiones y calendario del panel. */
  OFFERS_READ: 'offers.read',
  /** HU-27/28/29: crear y editar ofertas (asistente), docentes, imágenes, módulos, recursos, sesiones, eventos y lista Moodle. */
  OFFERS_WRITE: 'offers.write',
  /** HU-27: publicar, despublicar, archivar, duplicar y borrar borradores. */
  OFFERS_PUBLISH: 'offers.publish',

  /** HU-30: ver la asistencia por sesión y por participante y exportarla. */
  ATTENDANCE_READ: 'attendance.read',
  /** HU-30: marcar/desmarcar asistencia manual y "Recordar a pendientes". */
  ATTENDANCE_WRITE: 'attendance.write',

  /** HU-31: bandeja y detalle de postulaciones (incluye datos de contacto y evidencias). */
  APPLICATIONS_READ: 'applications.read',
  /** HU-31: evaluación propia (recomendación, nivel sugerido, comentario). */
  APPLICATIONS_EVALUATE: 'applications.evaluate',
  /** HU-31: agendar, marcar "Realizada" o cancelar la entrevista por Zoom. */
  APPLICATIONS_INTERVIEW: 'applications.interview',
  /** HU-31: "Registrar decisión" (aprobar / no seleccionar) y reintentar el correo de la decisión. */
  APPLICATIONS_DECIDE: 'applications.decide',

  /** HU-32: embudo, "Aprobados sin pagar", "Vencidas" y datos de contacto de seguimiento. */
  FOLLOW_UP_READ: 'followup.read',
  /** HU-32: recordatorios, WhatsApp, notas, extender plazo y cerrar inscripciones. */
  FOLLOW_UP_MANAGE: 'followup.manage',

  /** HU-33: consultar pagos, transferencias, planes y reembolsos (solo lectura). */
  PAYMENTS_READ: 'payments.read',
  /** HU-33: validar/rechazar transferencias, reintentar, mora, suspender/restablecer, cancelar plan, reembolsar. */
  PAYMENTS_MANAGE: 'payments.manage',

  /** Gestión de roles y estado de las cuentas del equipo. */
  USERS_MANAGE: 'users.manage',
  /** Consultar el registro de auditoría. */
  AUDIT_READ: 'audit.read',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(Permission);

const P = Permission;

/** Lo que cualquier integrante del equipo puede consultar. */
const STAFF_BASE: readonly Permission[] = [P.ADMIN_ACCESS, P.OFFERS_READ, P.PAYMENTS_READ];

/**
 * Matriz rol → permisos. Un usuario con varios roles tiene la unión. PARTICIPANT no tiene ninguno
 * (403 en todo `/admin/...`). SUPER_ADMIN tiene todos.
 *
 * | Rol                    | Para qué (HU)                                                                  |
 * |------------------------|---------------------------------------------------------------------------------|
 * | SUPER_ADMIN            | Todo, incluida la gestión de roles y la auditoría                                |
 * | ACADEMIC_COORDINATOR   | Ofertas, contenido, sesiones, asistencia (27–30); revisión y decisión (31); seguimiento (32) |
 * | REVIEW_COMMITTEE       | Revisión: evaluar y entrevistas, SIN registrar decisión (31)                      |
 * | REVIEW_DECIDER         | Revisión con permiso de decisión (31)                                             |
 * | FOLLOW_UP              | Seguimiento de postulación a inscripción (32)                                     |
 * | FINANCE                | Administración y finanzas: acciones sobre pagos (33)                              |
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  PARTICIPANT: [],
  SUPER_ADMIN: ALL_PERMISSIONS,
  ACADEMIC_COORDINATOR: [
    ...STAFF_BASE,
    P.OFFERS_WRITE,
    P.OFFERS_PUBLISH,
    P.ATTENDANCE_READ,
    P.ATTENDANCE_WRITE,
    P.APPLICATIONS_READ,
    P.APPLICATIONS_EVALUATE,
    P.APPLICATIONS_INTERVIEW,
    P.APPLICATIONS_DECIDE,
    P.FOLLOW_UP_READ,
    P.FOLLOW_UP_MANAGE,
  ],
  REVIEW_COMMITTEE: [
    ...STAFF_BASE,
    P.APPLICATIONS_READ,
    P.APPLICATIONS_EVALUATE,
    P.APPLICATIONS_INTERVIEW,
  ],
  REVIEW_DECIDER: [
    ...STAFF_BASE,
    P.APPLICATIONS_READ,
    P.APPLICATIONS_EVALUATE,
    P.APPLICATIONS_INTERVIEW,
    P.APPLICATIONS_DECIDE,
  ],
  FOLLOW_UP: [...STAFF_BASE, P.APPLICATIONS_READ, P.FOLLOW_UP_READ, P.FOLLOW_UP_MANAGE],
  FINANCE: [...STAFF_BASE, P.PAYMENTS_MANAGE],
};

/** Roles del equipo (todos menos PARTICIPANT). */
export const STAFF_ROLES: readonly Role[] = (Object.keys(ROLE_PERMISSIONS) as Role[]).filter(
  (role) => role !== 'PARTICIPANT',
);

/** Permisos efectivos (unión, sin duplicados, en el orden de `ALL_PERMISSIONS`). */
export function permissionsForRoles(roles: readonly Role[]): Permission[] {
  const granted = new Set<Permission>();
  for (const role of roles) for (const p of ROLE_PERMISSIONS[role] ?? []) granted.add(p);
  return ALL_PERMISSIONS.filter((p) => granted.has(p));
}

/** Permisos requeridos que faltan (vacío = autorizado). */
export function missingPermissions(
  roles: readonly Role[],
  required: readonly Permission[],
): Permission[] {
  const granted = new Set(permissionsForRoles(roles));
  return required.filter((p) => !granted.has(p));
}

/** ¿Algún rol del equipo? */
export function isStaff(roles: readonly Role[]): boolean {
  return roles.some((role) => role !== 'PARTICIPANT');
}
