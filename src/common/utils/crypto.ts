import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/** SHA-256 en hex (para tokens opacos de alta entropía: refresh, resetToken). */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** HMAC-SHA256 en hex (para valores de baja entropía: OTP, IP). */
export function hmacSha256Hex(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

/** Token opaco aleatorio (base64url). 32 bytes = 256 bits. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Código numérico aleatorio de `length` dígitos (con ceros a la izquierda). */
export function randomNumericCode(length: number): string {
  return String(randomInt(0, 10 ** length)).padStart(length, '0');
}

/** Comparación en tiempo constante de dos cadenas hex/ascii. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Enmascara un correo para mostrarlo (HU-03): `juana@correo.com` → `j***@correo.com`.
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 1)}***@${domain}`;
}
