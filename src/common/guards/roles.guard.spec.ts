import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../generated/prisma/enums';
import { AppException } from '../errors/app.exception';
import { hasAnyRole, RolesGuard } from './roles.guard';

function contextWith(user: unknown): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('hasAnyRole exige al menos uno', () => {
    expect(hasAnyRole([Role.PARTICIPANT], [Role.SUPER_ADMIN])).toBe(false);
    expect(hasAnyRole([Role.PARTICIPANT, Role.FINANCE], [Role.FINANCE])).toBe(true);
  });

  it('sin @Roles deja pasar', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
    const guard = new RolesGuard(reflector as unknown as Reflector);
    expect(guard.canActivate(contextWith({ roles: [] }))).toBe(true);
  });

  it('con @Roles y sin el rol → FORBIDDEN', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockImplementation((key: string) => (key === 'roles' ? [Role.SUPER_ADMIN] : undefined)),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);
    expect(() => guard.canActivate(contextWith({ roles: [Role.PARTICIPANT] }))).toThrow(
      AppException,
    );
    expect(guard.canActivate(contextWith({ roles: [Role.SUPER_ADMIN] }))).toBe(true);
  });
});
