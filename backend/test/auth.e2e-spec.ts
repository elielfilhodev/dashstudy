import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/common/prisma/prisma.service';
import { bootstrapTestApp, resetDatabase, uniqueUser } from './setup-e2e';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await bootstrapTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  const api = () => request(app.getHttpServer());

  describe('POST /auth/register', () => {
    it('cria o usuário com gamificação e perfil acadêmico', async () => {
      const user = uniqueUser();

      const res = await api()
        .post('/api/v1/auth/register')
        .send(user)
        .expect(201);

      expect(res.body.data).toMatchObject({
        email: user.email,
        username: user.username,
        name: user.name,
      });
      expect(res.body.data.displayId).toHaveLength(6);
      expect(res.body.data).not.toHaveProperty('password');

      const created = await prisma.user.findUnique({
        where: { email: user.email },
        include: { gamification: true, academicProfile: true },
      });
      expect(created?.gamification).not.toBeNull();
      expect(created?.academicProfile?.currentSemester).toBe(3);
    });

    it('nunca devolve a senha em texto puro nem o hash', async () => {
      const user = uniqueUser();
      const res = await api()
        .post('/api/v1/auth/register')
        .send(user)
        .expect(201);
      expect(JSON.stringify(res.body)).not.toContain(user.password);
    });

    it('rejeita e-mail duplicado', async () => {
      const user = uniqueUser();
      await api().post('/api/v1/auth/register').send(user).expect(201);

      const res = await api()
        .post('/api/v1/auth/register')
        .send({ ...uniqueUser(), email: user.email })
        .expect(400);

      expect(res.body.error).toContain('e-mail');
    });

    // O username é sempre gravado em minúsculas (register e OAuth normalizam),
    // e o schema rejeita maiúsculas na entrada — caso já coberto no it.each
    // abaixo. Por isso a duplicidade é testada com o mesmo username, que é a
    // única forma de a requisição chegar na checagem do service.
    it('rejeita username duplicado', async () => {
      const user = uniqueUser();
      await api().post('/api/v1/auth/register').send(user).expect(201);

      const res = await api()
        .post('/api/v1/auth/register')
        .send({ ...uniqueUser(), username: user.username })
        .expect(400);

      expect(res.body.error).toContain('username');
    });

    it('rejeita senhas que não conferem', async () => {
      await api()
        .post('/api/v1/auth/register')
        .send({ ...uniqueUser(), confirmPassword: 'outra-senha' })
        .expect(400);
    });

    it.each([
      ['username com maiúsculas', { username: 'UserInvalido' }],
      ['e-mail inválido', { email: 'nao-e-email' }],
      ['senha curta', { password: '123', confirmPassword: '123' }],
      ['semestre fora do intervalo', { currentSemester: 99 }],
      ['data em formato errado', { startDate: '01/02/2024' }],
    ])('rejeita %s', async (_label, override) => {
      await api()
        .post('/api/v1/auth/register')
        .send({ ...uniqueUser(), ...override })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('devolve access e refresh token com credenciais válidas', async () => {
      const user = uniqueUser();
      await api().post('/api/v1/auth/register').send(user).expect(201);

      const res = await api()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(200);

      expect(res.body.data).toMatchObject({ token_type: 'Bearer' });
      expect(typeof res.body.data.access_token).toBe('string');
      expect(typeof res.body.data.refresh_token).toBe('string');
      expect(res.body.data.expires_in).toBeGreaterThan(0);
    });

    it('rejeita senha errada', async () => {
      const user = uniqueUser();
      await api().post('/api/v1/auth/register').send(user).expect(201);

      await api()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'senha-errada' })
        .expect(401);
    });

    it('devolve a mesma resposta para usuário inexistente (anti-enumeração)', async () => {
      const res = await api()
        .post('/api/v1/auth/login')
        .send({ email: 'ninguem@example.com', password: 'senha123' })
        .expect(401);

      expect(res.body.error).toBe('E-mail ou senha inválidos');
    });

    it('persiste o refresh token apenas como hash', async () => {
      const user = uniqueUser();
      await api().post('/api/v1/auth/register').send(user).expect(201);
      const login = await api()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(200);

      const stored = await prisma.refreshToken.findMany();
      expect(stored).toHaveLength(1);
      expect(stored[0].tokenHash).not.toBe(login.body.data.refresh_token);
      expect(stored[0].tokenHash).toHaveLength(64);
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotaciona o refresh token e invalida o anterior', async () => {
      const user = uniqueUser();
      await api().post('/api/v1/auth/register').send(user).expect(201);
      const login = await api()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(200);

      const first = login.body.data.refresh_token as string;

      const refreshed = await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: first })
        .expect(200);

      expect(refreshed.body.data.refresh_token).not.toBe(first);

      // Reutilizar o token antigo tem de falhar.
      await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: first })
        .expect(401);
    });

    it('rejeita refresh token inexistente', async () => {
      await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'token-que-nao-existe' })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('revoga todos os refresh tokens do usuário', async () => {
      const user = uniqueUser();
      await api().post('/api/v1/auth/register').send(user).expect(201);
      const login = await api()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(200);

      await api()
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${login.body.data.access_token}`)
        .expect(200);

      await expect(prisma.refreshToken.count()).resolves.toBe(0);
      await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: login.body.data.refresh_token })
        .expect(401);
    });

    it('exige autenticação', async () => {
      await api().post('/api/v1/auth/logout').expect(401);
    });
  });

  describe('Recuperação de senha', () => {
    it('responde igual para e-mail cadastrado e desconhecido', async () => {
      const user = uniqueUser();
      await api().post('/api/v1/auth/register').send(user).expect(201);

      const known = await api()
        .post('/api/v1/auth/forgot-password')
        .send({ email: user.email })
        .expect(200);
      const unknown = await api()
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'ninguem@example.com' })
        .expect(200);

      expect(known.body.data.message).toBe(unknown.body.data.message);
    });

    it('troca a senha com um token válido e invalida as sessões', async () => {
      const user = uniqueUser();
      await api().post('/api/v1/auth/register').send(user).expect(201);
      await api()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(200);
      await api()
        .post('/api/v1/auth/forgot-password')
        .send({ email: user.email });

      const record = await prisma.verificationToken.findFirst({
        where: { identifier: user.email },
      });
      expect(record).not.toBeNull();

      await api()
        .post('/api/v1/auth/reset-password')
        .send({
          token: record!.token,
          newPassword: 'nova-senha-1',
          confirmPassword: 'nova-senha-1',
        })
        .expect(200);

      await api()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'nova-senha-1' })
        .expect(200);
      await api()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(401);
      await expect(prisma.verificationToken.count()).resolves.toBe(0);
    });

    it('rejeita um token de reset já usado', async () => {
      const user = uniqueUser();
      await api().post('/api/v1/auth/register').send(user).expect(201);
      await api()
        .post('/api/v1/auth/forgot-password')
        .send({ email: user.email });

      const record = await prisma.verificationToken.findFirstOrThrow({
        where: { identifier: user.email },
      });
      const body = {
        token: record.token,
        newPassword: 'nova-senha-1',
        confirmPassword: 'nova-senha-1',
      };

      await api().post('/api/v1/auth/reset-password').send(body).expect(200);
      await api().post('/api/v1/auth/reset-password').send(body).expect(400);
    });

    it('rejeita um token expirado e o remove', async () => {
      const user = uniqueUser();
      await api().post('/api/v1/auth/register').send(user).expect(201);
      await api()
        .post('/api/v1/auth/forgot-password')
        .send({ email: user.email });

      const record = await prisma.verificationToken.findFirstOrThrow({
        where: { identifier: user.email },
      });
      await prisma.verificationToken.update({
        where: { token: record.token },
        data: { expires: new Date(Date.now() - 1000) },
      });

      await api()
        .post('/api/v1/auth/reset-password')
        .send({
          token: record.token,
          newPassword: 'nova-senha-1',
          confirmPassword: 'nova-senha-1',
        })
        .expect(400);

      await expect(prisma.verificationToken.count()).resolves.toBe(0);
    });
  });

  describe('Guard JWT', () => {
    it('bloqueia rotas protegidas sem token', async () => {
      await api().get('/api/v1/tasks').expect(401);
    });

    it('bloqueia token malformado', async () => {
      await api()
        .get('/api/v1/tasks')
        .set('Authorization', 'Bearer nao-e-um-jwt')
        .expect(401);
    });

    it('libera /health sem autenticação', async () => {
      await api().get('/health').expect(200);
    });
  });
});
