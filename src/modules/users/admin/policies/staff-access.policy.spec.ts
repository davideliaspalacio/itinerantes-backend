import {
  bootstrapAdminIssues,
  normalizeRoles,
  staffChangeIssue,
  type StaffChangeInput,
  usernameFromEmail,
} from './staff-access.policy';

const base: StaffChangeInput = {
  actorId: 'a',
  targetId: 'b',
  currentRoles: ['PARTICIPANT', 'FINANCE'],
  currentlyActive: true,
  nextRoles: ['PARTICIPANT'],
  nextActive: true,
  activeSuperAdmins: 2,
};

describe('staff-access.policy', () => {
  it('normalizeRoles conserva PARTICIPANT y quita duplicados', () => {
    expect(normalizeRoles(['FINANCE', 'FINANCE'])).toEqual(['PARTICIPANT', 'FINANCE']);
    expect(normalizeRoles([])).toEqual(['PARTICIPANT']);
  });

  it('permite cambios normales', () => {
    expect(staffChangeIssue(base)).toBeNull();
  });

  it('nadie se quita a sí mismo SUPER_ADMIN ni se deshabilita', () => {
    const self = { ...base, targetId: 'a', currentRoles: ['SUPER_ADMIN'] as const };
    expect(staffChangeIssue({ ...self, nextRoles: ['PARTICIPANT'] })).toBe('ADMIN_SELF_ACTION');
    expect(staffChangeIssue({ ...self, nextRoles: ['SUPER_ADMIN'], nextActive: false })).toBe(
      'ADMIN_SELF_ACTION',
    );
    expect(staffChangeIssue({ ...self, nextRoles: ['SUPER_ADMIN', 'FINANCE'] })).toBeNull();
  });

  it('debe quedar al menos un SUPER_ADMIN activo', () => {
    const lastSuper = { ...base, currentRoles: ['SUPER_ADMIN'] as const, activeSuperAdmins: 1 };
    expect(staffChangeIssue({ ...lastSuper, nextRoles: ['FINANCE'] })).toBe(
      'ADMIN_LAST_SUPER_ADMIN',
    );
    expect(staffChangeIssue({ ...lastSuper, nextRoles: ['SUPER_ADMIN'], nextActive: false })).toBe(
      'ADMIN_LAST_SUPER_ADMIN',
    );
    expect(staffChangeIssue({ ...lastSuper, activeSuperAdmins: 2, nextRoles: [] })).toBeNull();
  });

  it('bootstrapAdminIssues valida correo y contraseña robusta', () => {
    expect(bootstrapAdminIssues({ email: 'x' }, { requirePassword: false })).toHaveLength(1);
    expect(
      bootstrapAdminIssues({ email: 'a@b.mx', password: 'corta1' }, { requirePassword: true }),
    ).toHaveLength(1);
    expect(
      bootstrapAdminIssues(
        { email: 'a@b.mx', password: 'solo-letras-largas' },
        { requirePassword: true },
      ),
    ).toEqual(['BOOTSTRAP_ADMIN_PASSWORD debe incluir al menos una letra y un número.']);
    expect(
      bootstrapAdminIssues(
        { email: ' Admin@Escuela.MX ', password: 'AguaViva2026segura' },
        { requirePassword: true },
      ),
    ).toEqual([]);
    expect(bootstrapAdminIssues({ email: 'a@b.mx' }, { requirePassword: false })).toEqual([]);
  });

  it('usernameFromEmail genera un username válido', () => {
    expect(usernameFromEmail('Laura.Coord@escuela.mx')).toBe('laura.coord');
    expect(usernameFromEmail('a+b@x.mx', '7')).toBe('adminab7');
    expect(usernameFromEmail(`${'x'.repeat(40)}@x.mx`, '12')).toHaveLength(30);
  });
});
