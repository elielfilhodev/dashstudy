import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { uniqueUser } from './setup-e2e';

export type TestUser = {
  id: string;
  email: string;
  username: string;
  token: string;
};

/** Registra e autentica um usuário, devolvendo o access token pronto para uso. */
export async function createUser(app: INestApplication): Promise<TestUser> {
  const payload = uniqueUser();
  const api = request(app.getHttpServer());

  const registered = await api
    .post('/api/v1/auth/register')
    .send(payload)
    .expect(201);
  const login = await api
    .post('/api/v1/auth/login')
    .send({ email: payload.email, password: payload.password })
    .expect(200);

  return {
    id: registered.body.data.id,
    email: payload.email,
    username: payload.username,
    token: login.body.data.access_token,
  };
}

/** Deixa dois usuários com amizade ACEITA e devolve o id da amizade. */
export async function makeFriends(
  app: INestApplication,
  a: TestUser,
  b: TestUser,
): Promise<string> {
  const api = request(app.getHttpServer());

  const requested = await api
    .post('/api/v1/friends')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ username: b.username })
    .expect(200);

  const friendshipId = requested.body.data.friendship.id as string;

  await api
    .patch(`/api/v1/friends/${friendshipId}`)
    .set('Authorization', `Bearer ${b.token}`)
    .send({ action: 'accept' })
    .expect(200);

  return friendshipId;
}

export function auth(app: INestApplication, user: TestUser) {
  const agent = request(app.getHttpServer());
  const header = `Bearer ${user.token}`;

  return {
    get: (url: string) => agent.get(url).set('Authorization', header),
    post: (url: string) => agent.post(url).set('Authorization', header),
    patch: (url: string) => agent.patch(url).set('Authorization', header),
    delete: (url: string) => agent.delete(url).set('Authorization', header),
  };
}
