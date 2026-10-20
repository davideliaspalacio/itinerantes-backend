import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/** Hash de contraseñas con argon2id (parámetros por defecto de la librería, recomendados por OWASP). */
@Injectable()
export class PasswordService {
  /** Hash precalculado para igualar tiempos cuando el usuario no existe (evita enumeración por tiempo). */
  private dummyHash?: Promise<string>;

  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /** Ejecuta una verificación ficticia (mismo costo) y devuelve false. */
  async verifyDummy(password: string): Promise<false> {
    this.dummyHash ??= this.hash('dummy-password-for-timing-1');
    await this.verify(await this.dummyHash, password);
    return false;
  }
}
