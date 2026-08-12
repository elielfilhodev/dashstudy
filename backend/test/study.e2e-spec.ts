import type { INestApplication } from '@nestjs/common';
import type { PrismaService } from '../src/common/prisma/prisma.service';
import { auth, createUser, type TestUser } from './helpers';
import { bootstrapTestApp, resetDatabase } from './setup-e2e';

describe('Estudos: subjects, tasks, goals, agenda, gamification (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: TestUser;
  let intruder: TestUser;

  beforeAll(async () => {
    ({ app, prisma } = await bootstrapTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    owner = await createUser(app);
    intruder = await createUser(app);
  });

  describe('Subjects', () => {
    it('cria, lista, atualiza progresso e remove', async () => {
      const api = auth(app, owner);

      const created = await api
        .post('/api/v1/subjects')
        .send({ name: 'Cálculo I', workload: 60 })
        .expect(201);
      expect(created.body.data).toMatchObject({
        name: 'Cálculo I',
        workload: 60,
        progress: 0,
        color: '#18181b',
      });

      const list = await api.get('/api/v1/subjects').expect(200);
      expect(list.body.data).toHaveLength(1);

      const patched = await api
        .patch(`/api/v1/subjects/${created.body.data.id}`)
        .send({ progress: 45 })
        .expect(200);
      expect(patched.body.data.progress).toBe(45);

      await api.delete(`/api/v1/subjects/${created.body.data.id}`).expect(204);
      await expect(prisma.subject.count()).resolves.toBe(0);
    });

    it('só lista as matérias do próprio usuário', async () => {
      await auth(app, owner)
        .post('/api/v1/subjects')
        .send({ name: 'Cálculo I', workload: 60 })
        .expect(201);

      const list = await auth(app, intruder)
        .get('/api/v1/subjects')
        .expect(200);
      expect(list.body.data).toHaveLength(0);
    });

    it('devolve 403 ao mexer em matéria de outro usuário', async () => {
      const created = await auth(app, owner)
        .post('/api/v1/subjects')
        .send({ name: 'Cálculo I', workload: 60 })
        .expect(201);

      await auth(app, intruder)
        .patch(`/api/v1/subjects/${created.body.data.id}`)
        .send({ progress: 100 })
        .expect(403);
      await auth(app, intruder)
        .delete(`/api/v1/subjects/${created.body.data.id}`)
        .expect(403);
    });

    it('devolve 404 para matéria inexistente', async () => {
      await auth(app, owner)
        .patch('/api/v1/subjects/clzzzzzzzzzzzzzzzzzzzzzz')
        .send({ progress: 10 })
        .expect(404);
    });

    it('rejeita progresso fora de 0–100', async () => {
      const created = await auth(app, owner)
        .post('/api/v1/subjects')
        .send({ name: 'Cálculo I', workload: 60 })
        .expect(201);

      await auth(app, owner)
        .patch(`/api/v1/subjects/${created.body.data.id}`)
        .send({ progress: 101 })
        .expect(400);
    });
  });

  describe('Tasks', () => {
    it('cria a tarefa vinculada a uma matéria', async () => {
      const api = auth(app, owner);
      const subject = await api
        .post('/api/v1/subjects')
        .send({ name: 'Física', workload: 60 })
        .expect(201);

      const task = await api
        .post('/api/v1/tasks')
        .send({
          title: 'Lista 3',
          dueDate: '2026-09-01',
          subjectId: subject.body.data.id,
        })
        .expect(201);

      expect(task.body.data).toMatchObject({
        title: 'Lista 3',
        done: false,
        details: '',
        subject: { name: 'Física' },
      });
    });

    it('marca a tarefa como concluída via PATCH parcial', async () => {
      const api = auth(app, owner);
      const task = await api
        .post('/api/v1/tasks')
        .send({ title: 'Lista 3', dueDate: '2026-09-01' })
        .expect(201);

      const patched = await api
        .patch(`/api/v1/tasks/${task.body.data.id}`)
        .send({ done: true })
        .expect(200);

      expect(patched.body.data).toMatchObject({ done: true, title: 'Lista 3' });
    });

    it('rejeita data em formato inválido', async () => {
      await auth(app, owner)
        .post('/api/v1/tasks')
        .send({ title: 'Lista 3', dueDate: '01/09/2026' })
        .expect(400);
    });

    it('impede acesso a tarefa de outro usuário', async () => {
      const task = await auth(app, owner)
        .post('/api/v1/tasks')
        .send({ title: 'Lista 3', dueDate: '2026-09-01' })
        .expect(201);

      await auth(app, intruder)
        .patch(`/api/v1/tasks/${task.body.data.id}`)
        .send({ done: true })
        .expect(403);
    });
  });

  describe('Goals', () => {
    it('trata done como contador de progresso, não booleano', async () => {
      const api = auth(app, owner);
      const goal = await api
        .post('/api/v1/goals')
        .send({ title: 'Ler 10 livros', target: 10 })
        .expect(201);
      expect(goal.body.data.done).toBe(0);

      const patched = await api
        .patch(`/api/v1/goals/${goal.body.data.id}`)
        .send({ done: 4 })
        .expect(200);
      expect(patched.body.data.done).toBe(4);
    });

    it('rejeita target não positivo', async () => {
      await auth(app, owner)
        .post('/api/v1/goals')
        .send({ title: 'Meta inválida', target: 0 })
        .expect(400);
    });
  });

  describe('Agenda', () => {
    it('cria item com local padrão e ordena por data e hora', async () => {
      const api = auth(app, owner);

      await api
        .post('/api/v1/agenda')
        .send({ title: 'Prova', date: '2026-09-10', time: '14:00' })
        .expect(201);
      await api
        .post('/api/v1/agenda')
        .send({ title: 'Aula', date: '2026-09-01', time: '08:00' })
        .expect(201);

      const list = await api.get('/api/v1/agenda').expect(200);
      expect(list.body.data.map((i: { title: string }) => i.title)).toEqual([
        'Aula',
        'Prova',
      ]);
      expect(list.body.data[0].location).toBe('Não definido');
    });

    it('rejeita horário em formato inválido', async () => {
      await auth(app, owner)
        .post('/api/v1/agenda')
        .send({ title: 'Prova', date: '2026-09-10', time: '2pm' })
        .expect(400);
    });
  });

  describe('Gamification', () => {
    it('cria a linha zerada no primeiro GET', async () => {
      const res = await auth(app, owner)
        .get('/api/v1/gamification')
        .expect(200);

      expect(res.body.data).toMatchObject({
        xp: 0,
        streakDays: 0,
        totalCompletions: 0,
      });
      expect(res.body.data.levelInfo).toMatchObject({
        level: 1,
        nextLevelXp: 100,
      });
    });

    it('concede XP ao concluir uma tarefa e desbloqueia FIRST_TASK', async () => {
      const api = auth(app, owner);
      const task = await api
        .post('/api/v1/tasks')
        .send({ title: 'Lista 1', dueDate: '2026-09-01' })
        .expect(201);

      const res = await api
        .post('/api/v1/gamification')
        .send({ taskId: task.body.data.id })
        .expect(200);

      expect(res.body.data).toMatchObject({
        xp: 20,
        streakDays: 1,
        totalCompletions: 1,
        newAchievementKeys: ['FIRST_TASK'],
      });
      expect(res.body.data.reward).toMatchObject({
        xpEarned: 20,
        streakDays: 1,
      });
    });

    it('não premia duas vezes a mesma tarefa já concluída', async () => {
      const api = auth(app, owner);
      const task = await api
        .post('/api/v1/tasks')
        .send({ title: 'Lista 1', dueDate: '2026-09-01' })
        .expect(201);

      await api
        .post('/api/v1/gamification')
        .send({ taskId: task.body.data.id })
        .expect(200);
      await api
        .patch(`/api/v1/tasks/${task.body.data.id}`)
        .send({ done: true })
        .expect(200);

      const second = await api
        .post('/api/v1/gamification')
        .send({ taskId: task.body.data.id })
        .expect(200);

      expect(second.body.data).toEqual({ skipped: true });

      const state = await api.get('/api/v1/gamification').expect(200);
      expect(state.body.data.xp).toBe(20);
    });

    it('ignora tarefa de outro usuário', async () => {
      const task = await auth(app, owner)
        .post('/api/v1/tasks')
        .send({ title: 'Lista 1', dueDate: '2026-09-01' })
        .expect(201);

      const res = await auth(app, intruder)
        .post('/api/v1/gamification')
        .send({ taskId: task.body.data.id })
        .expect(200);

      expect(res.body.data).toEqual({ skipped: true });
    });

    it('ignora corpo inválido em silêncio, sem 400', async () => {
      const res = await auth(app, owner)
        .post('/api/v1/gamification')
        .send({ taskId: 'nao-e-cuid' })
        .expect(200);

      expect(res.body.data).toEqual({ skipped: true });
    });
  });

  describe('GET /profile/activity', () => {
    it('agrupa as tarefas concluídas por dia', async () => {
      const api = auth(app, owner);
      const task = await api
        .post('/api/v1/tasks')
        .send({ title: 'Lista 1', dueDate: '2026-09-01' })
        .expect(201);
      await api
        .patch(`/api/v1/tasks/${task.body.data.id}`)
        .send({ done: true })
        .expect(200);

      const res = await api.get('/api/v1/profile/activity').expect(200);
      const today = new Date().toISOString().slice(0, 10);
      expect(res.body.data[today]).toBe(1);
    });
  });
});
