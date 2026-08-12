import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

const MAX_FAILURES = 8;
const LOCK_DURATION_MS = 15 * 60 * 1000;

/**
 * Hash descartável comparado quando o e-mail não existe, para que login com
 * usuário inexistente custe o mesmo tempo que com usuário real (anti-enumeração).
 */
const DUMMY_HASH =
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

type Entry = { failures: number; lockedUntil: number };

@Injectable()
export class LoginLockService {
  private readonly entries = new Map<string, Entry>();

  private key(ip: string, email: string): string {
    return `${ip}|${email.toLowerCase()}`;
  }

  isLocked(ip: string, email: string): boolean {
    const entry = this.entries.get(this.key(ip, email));
    if (!entry) return false;
    if (entry.lockedUntil > Date.now()) return true;
    if (entry.lockedUntil !== 0) this.entries.delete(this.key(ip, email));
    return false;
  }

  recordFailure(ip: string, email: string): void {
    const k = this.key(ip, email);
    const entry = this.entries.get(k) ?? { failures: 0, lockedUntil: 0 };
    entry.failures += 1;
    if (entry.failures >= MAX_FAILURES) {
      entry.lockedUntil = Date.now() + LOCK_DURATION_MS;
      entry.failures = 0;
    }
    this.entries.set(k, entry);
  }

  recordSuccess(ip: string, email: string): void {
    this.entries.delete(this.key(ip, email));
  }

  /** Compara a senha; sem hash real, gasta o mesmo tempo contra o hash descartável. */
  async comparePassword(
    hash: string | null,
    password: string,
  ): Promise<boolean> {
    if (!hash) {
      await bcrypt.compare(password, DUMMY_HASH);
      return false;
    }
    return bcrypt.compare(password, hash);
  }
}
