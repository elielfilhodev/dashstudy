import * as bcrypt from 'bcryptjs';
import { LoginLockService } from './login-lock.service';

describe('LoginLockService', () => {
  let lock: LoginLockService;

  beforeEach(() => {
    lock = new LoginLockService();
  });

  it('não bloqueia antes de acumular falhas', () => {
    expect(lock.isLocked('1.1.1.1', 'a@b.com')).toBe(false);
  });

  it('bloqueia após 8 falhas do mesmo IP e e-mail', () => {
    for (let i = 0; i < 7; i++) lock.recordFailure('1.1.1.1', 'a@b.com');
    expect(lock.isLocked('1.1.1.1', 'a@b.com')).toBe(false);

    lock.recordFailure('1.1.1.1', 'a@b.com');
    expect(lock.isLocked('1.1.1.1', 'a@b.com')).toBe(true);
  });

  it('trata o e-mail como case-insensitive', () => {
    for (let i = 0; i < 8; i++) lock.recordFailure('1.1.1.1', 'A@B.com');
    expect(lock.isLocked('1.1.1.1', 'a@b.com')).toBe(true);
  });

  it('isola o bloqueio por IP', () => {
    for (let i = 0; i < 8; i++) lock.recordFailure('1.1.1.1', 'a@b.com');
    expect(lock.isLocked('2.2.2.2', 'a@b.com')).toBe(false);
  });

  it('limpa o contador após um login bem-sucedido', () => {
    for (let i = 0; i < 7; i++) lock.recordFailure('1.1.1.1', 'a@b.com');
    lock.recordSuccess('1.1.1.1', 'a@b.com');

    for (let i = 0; i < 7; i++) lock.recordFailure('1.1.1.1', 'a@b.com');
    expect(lock.isLocked('1.1.1.1', 'a@b.com')).toBe(false);
  });

  it('libera o acesso depois que o bloqueio expira', () => {
    for (let i = 0; i < 8; i++) lock.recordFailure('1.1.1.1', 'a@b.com');
    expect(lock.isLocked('1.1.1.1', 'a@b.com')).toBe(true);

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 16 * 60 * 1000);
    expect(lock.isLocked('1.1.1.1', 'a@b.com')).toBe(false);
    jest.restoreAllMocks();
  });

  describe('comparePassword', () => {
    it('valida a senha correta', async () => {
      const hash = await bcrypt.hash('segredo123', 4);
      await expect(lock.comparePassword(hash, 'segredo123')).resolves.toBe(
        true,
      );
    });

    it('rejeita a senha errada', async () => {
      const hash = await bcrypt.hash('segredo123', 4);
      await expect(lock.comparePassword(hash, 'errada')).resolves.toBe(false);
    });

    it('rejeita quando não há hash, sem lançar erro (anti-enumeração)', async () => {
      await expect(lock.comparePassword(null, 'qualquer')).resolves.toBe(false);
    });
  });
});
