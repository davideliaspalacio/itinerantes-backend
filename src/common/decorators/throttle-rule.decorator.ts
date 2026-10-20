import { Throttle } from '@nestjs/throttler';

/**
 * @Throttle estricto por IP a partir de una regla `{ limit, ttlSeconds }` de BUSINESS_RULES
 * (se suma al límite global).
 *
 * @example @ThrottleRule(BUSINESS_RULES.AUTH_THROTTLE.LOGIN)
 */
export function ThrottleRule(rule: {
  limit: number;
  ttlSeconds: number;
}): MethodDecorator & ClassDecorator {
  return Throttle({ default: { limit: rule.limit, ttl: rule.ttlSeconds * 1000 } });
}
