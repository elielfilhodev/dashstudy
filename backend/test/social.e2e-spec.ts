import type { INestApplication } from '@nestjs/common';
import type { PrismaService } from '../src/common/prisma/prisma.service';
import { auth, createUser, makeFriends, type TestUser } from './helpers';
import { bootstrapTestApp, resetDatabase } from './setup-e2e';

describe('Social: friends, books, chat (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let alice: TestUser;
  let bob: TestUser;
  let carol: TestUser;

  beforeAll(async () => {
    ({ app, prisma } = await bootstrapTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    alice = await createUser(app);
    bob = await createUser(app);
    carol = await createUser(app);
  });

  describe('Friends', () => {
    it('envia, recebe e aceita uma solicitação', async () => {
      const requested = await auth(app, alice)
        .post('/api/v1/friends')
        .send({ username: bob.username })
        .expect(200);

      const pending = await auth(app, bob).get('/api/v1/friends').expect(200);
      expect(pending.body.data.pendingReceived).toHaveLength(1);
      expect(pending.body.data.friends).toHaveLength(0);

      await auth(app, bob)
        .patch(`/api/v1/friends/${requested.body.data.friendship.id}`)
        .send({ action: 'accept' })
        .expect(200);

      const accepted = await auth(app, bob).get('/api/v1/friends').expect(200);
      expect(accepted.body.data.friends).toHaveLength(1);
      expect(accepted.body.data.friends[0].id).toBe(alice.id);
    });

    it('impede que quem enviou aceite a própria solicitação', async () => {
      const requested = await auth(app, alice)
        .post('/api/v1/friends')
        .send({ username: bob.username })
        .expect(200);

      await auth(app, alice)
        .patch(`/api/v1/friends/${requested.body.data.friendship.id}`)
        .send({ action: 'accept' })
        .expect(403);
    });

    it('impede que um terceiro interfira na amizade', async () => {
      const requested = await auth(app, alice)
        .post('/api/v1/friends')
        .send({ username: bob.username })
        .expect(200);

      await auth(app, carol)
        .patch(`/api/v1/friends/${requested.body.data.friendship.id}`)
        .send({ action: 'accept' })
        .expect(403);
    });

    it('rejeita solicitação duplicada e amizade já existente', async () => {
      await auth(app, alice)
        .post('/api/v1/friends')
        .send({ username: bob.username })
        .expect(200);

      const duplicate = await auth(app, alice)
        .post('/api/v1/friends')
        .send({ username: bob.username })
        .expect(400);
      expect(duplicate.body.error).toContain('já enviada');
    });

    it('impede adicionar a si mesmo', async () => {
      await auth(app, alice)
        .post('/api/v1/friends')
        .send({ username: alice.username })
        .expect(400);
    });

    it('remove a amizade com DELETE', async () => {
      const friendshipId = await makeFriends(app, alice, bob);
      await auth(app, bob)
        .delete(`/api/v1/friends/${friendshipId}`)
        .expect(204);

      const list = await auth(app, alice).get('/api/v1/friends').expect(200);
      expect(list.body.data.friends).toHaveLength(0);
    });

    it('expõe o perfil só para amigos', async () => {
      await makeFriends(app, alice, bob);

      const allowed = await auth(app, alice)
        .get(`/api/v1/friends/profile/${bob.id}`)
        .expect(200);
      expect(allowed.body.data.user.id).toBe(bob.id);
      expect(allowed.body.data.user).not.toHaveProperty('email');

      await auth(app, carol)
        .get(`/api/v1/friends/profile/${bob.id}`)
        .expect(403);
    });
  });

  describe('Books', () => {
    it('cria e lista os livros do dono', async () => {
      const created = await auth(app, alice)
        .post('/api/v1/books')
        .send({ title: 'Clean Code', author: 'Robert Martin', rating: 5 })
        .expect(201);

      expect(created.body.data).toMatchObject({
        title: 'Clean Code',
        hasCover: false,
        notesCount: 0,
      });
      expect(created.body.data).not.toHaveProperty('coverBlob');

      const list = await auth(app, alice).get('/api/v1/books').expect(200);
      expect(list.body.data).toHaveLength(1);
    });

    it('rejeita URL de capa que não seja http(s)', async () => {
      await auth(app, alice)
        .post('/api/v1/books')
        .send({ title: 'Livro', coverUrl: 'javascript:alert(1)' })
        .expect(400);
    });

    it('mostra o livro ao amigo sem revelar as anotações', async () => {
      await makeFriends(app, alice, bob);
      const book = await auth(app, alice)
        .post('/api/v1/books')
        .send({ title: 'Clean Code' })
        .expect(201);
      await auth(app, alice)
        .post(`/api/v1/books/${book.body.data.id}/notes`)
        .send({ body: 'Anotação privada' })
        .expect(201);

      const asFriend = await auth(app, bob)
        .get(`/api/v1/books/${book.body.data.id}`)
        .expect(200);

      expect(asFriend.body.data.role).toBe('friend');
      expect(asFriend.body.data.book).not.toHaveProperty('notes');
      expect(asFriend.body.data.book.notesCount).toBe(0);
      expect(JSON.stringify(asFriend.body)).not.toContain('Anotação privada');
    });

    it('esconde o livro de quem não é amigo', async () => {
      const book = await auth(app, alice)
        .post('/api/v1/books')
        .send({ title: 'Clean Code' })
        .expect(201);

      await auth(app, carol)
        .get(`/api/v1/books/${book.body.data.id}`)
        .expect(404);
    });

    it('deixa só o dono criar anotações', async () => {
      await makeFriends(app, alice, bob);
      const book = await auth(app, alice)
        .post('/api/v1/books')
        .send({ title: 'Clean Code' })
        .expect(201);

      await auth(app, bob)
        .post(`/api/v1/books/${book.body.data.id}/notes`)
        .send({ body: 'Não deveria funcionar' })
        .expect(403);
    });

    it('deixa só amigos comentarem — o dono usa anotações', async () => {
      await makeFriends(app, alice, bob);
      const book = await auth(app, alice)
        .post('/api/v1/books')
        .send({ title: 'Clean Code' })
        .expect(201);

      const asOwner = await auth(app, alice)
        .post(`/api/v1/books/${book.body.data.id}/comments`)
        .send({ body: 'Comentário do dono' })
        .expect(400);
      expect(asOwner.body.error).toContain('anotações');

      await auth(app, bob)
        .post(`/api/v1/books/${book.body.data.id}/comments`)
        .send({ body: 'Ótimo livro!' })
        .expect(201);
    });

    it('limpa a capa enviada ao definir uma URL externa', async () => {
      const book = await auth(app, alice)
        .post('/api/v1/books')
        .send({ title: 'Clean Code' })
        .expect(201);

      await prisma.book.update({
        where: { id: book.body.data.id },
        data: { coverBlob: Buffer.from('fake'), coverMime: 'image/png' },
      });

      await auth(app, alice)
        .patch(`/api/v1/books/${book.body.data.id}`)
        .send({ coverUrl: 'https://exemplo.com/capa.png' })
        .expect(200);

      const updated = await prisma.book.findUniqueOrThrow({
        where: { id: book.body.data.id },
      });
      expect(updated.coverBlob).toBeNull();
      expect(updated.coverMime).toBeNull();
    });

    it('rejeita PATCH sem nenhum campo', async () => {
      const book = await auth(app, alice)
        .post('/api/v1/books')
        .send({ title: 'Clean Code' })
        .expect(201);

      await auth(app, alice)
        .patch(`/api/v1/books/${book.body.data.id}`)
        .send({})
        .expect(400);
    });
  });

  describe('Chat direto', () => {
    it('troca mensagens entre amigos', async () => {
      await makeFriends(app, alice, bob);

      const sent = await auth(app, alice)
        .post(`/api/v1/chat/direct/${bob.id}`)
        .send({ content: 'Oi Bob' })
        .expect(201);
      expect(sent.body.data).toMatchObject({
        content: 'Oi Bob',
        senderId: alice.id,
      });

      const inbox = await auth(app, bob)
        .get(`/api/v1/chat/direct/${alice.id}`)
        .expect(200);
      expect(inbox.body.data).toHaveLength(1);
      expect(inbox.body.data[0].content).toBe('Oi Bob');
    });

    it('bloqueia DM com quem não é amigo', async () => {
      await auth(app, alice)
        .post(`/api/v1/chat/direct/${carol.id}`)
        .send({ content: 'Oi' })
        .expect(403);
      await auth(app, alice).get(`/api/v1/chat/direct/${carol.id}`).expect(403);
    });

    it('impede conversar consigo mesmo', async () => {
      await auth(app, alice).get(`/api/v1/chat/direct/${alice.id}`).expect(400);
    });

    it('exige conteúdo ou anexo', async () => {
      await makeFriends(app, alice, bob);
      await auth(app, alice)
        .post(`/api/v1/chat/direct/${bob.id}`)
        .send({ content: '   ' })
        .expect(400);
    });

    it('aceita mensagem só com anexo', async () => {
      await makeFriends(app, alice, bob);
      await auth(app, alice)
        .post(`/api/v1/chat/direct/${bob.id}`)
        .send({
          content: '',
          attachmentUrl: 'https://exemplo.com/foto.png',
          attachmentType: 'image',
        })
        .expect(201);
    });

    it('lista conversas com última mensagem e não lidas', async () => {
      await makeFriends(app, alice, bob);
      await auth(app, alice)
        .post(`/api/v1/chat/direct/${bob.id}`)
        .send({ content: 'Primeira' })
        .expect(201);
      await auth(app, alice)
        .post(`/api/v1/chat/direct/${bob.id}`)
        .send({ content: 'Segunda' })
        .expect(201);

      const conversations = await auth(app, bob)
        .get('/api/v1/chat/conversations')
        .expect(200);

      const direct = conversations.body.data.find(
        (c: { type: string }) => c.type === 'direct',
      );
      expect(direct.lastMessage.content).toBe('Segunda');
      expect(direct.unread).toBe(2);
    });
  });

  describe('Grupos de chat', () => {
    it('cria o grupo com o criador como admin e membro', async () => {
      const group = await auth(app, alice)
        .post('/api/v1/chat/groups')
        .send({ name: 'Turma de Cálculo' })
        .expect(201);

      expect(group.body.data).toMatchObject({
        name: 'Turma de Cálculo',
        adminId: alice.id,
      });
      expect(group.body.data.members).toHaveLength(1);
    });

    it('permite ao admin adicionar um amigo', async () => {
      await makeFriends(app, alice, bob);
      const group = await auth(app, alice)
        .post('/api/v1/chat/groups')
        .send({ name: 'Turma' })
        .expect(201);

      await auth(app, alice)
        .post(`/api/v1/chat/groups/${group.body.data.id}/members`)
        .send({ userId: bob.id })
        .expect(201);

      const members = await auth(app, bob)
        .get(`/api/v1/chat/groups/${group.body.data.id}/members`)
        .expect(200);
      expect(members.body.data).toHaveLength(2);
    });

    it('recusa adicionar quem não é amigo', async () => {
      const group = await auth(app, alice)
        .post('/api/v1/chat/groups')
        .send({ name: 'Turma' })
        .expect(201);

      const res = await auth(app, alice)
        .post(`/api/v1/chat/groups/${group.body.data.id}/members`)
        .send({ userId: carol.id })
        .expect(400);
      expect(res.body.error).toContain('amigos');
    });

    it('bloqueia não membros de ler o grupo e suas mensagens', async () => {
      const group = await auth(app, alice)
        .post('/api/v1/chat/groups')
        .send({ name: 'Turma' })
        .expect(201);

      await auth(app, bob)
        .get(`/api/v1/chat/groups/${group.body.data.id}`)
        .expect(403);
      await auth(app, bob)
        .get(`/api/v1/chat/groups/${group.body.data.id}/messages`)
        .expect(403);
    });

    it('deixa só o admin editar e apagar o grupo', async () => {
      await makeFriends(app, alice, bob);
      const group = await auth(app, alice)
        .post('/api/v1/chat/groups')
        .send({ name: 'Turma' })
        .expect(201);
      await auth(app, alice)
        .post(`/api/v1/chat/groups/${group.body.data.id}/members`)
        .send({ userId: bob.id })
        .expect(201);

      await auth(app, bob)
        .patch(`/api/v1/chat/groups/${group.body.data.id}`)
        .send({ name: 'Renomeado' })
        .expect(403);
      await auth(app, bob)
        .delete(`/api/v1/chat/groups/${group.body.data.id}`)
        .expect(403);

      await auth(app, alice)
        .patch(`/api/v1/chat/groups/${group.body.data.id}`)
        .send({ name: 'Renomeado' })
        .expect(200);
    });

    it('promove e rebaixa co-admin, e impede o admin de se autopromover', async () => {
      await makeFriends(app, alice, bob);
      const group = await auth(app, alice)
        .post('/api/v1/chat/groups')
        .send({ name: 'Turma' })
        .expect(201);
      const groupId = group.body.data.id;
      await auth(app, alice)
        .post(`/api/v1/chat/groups/${groupId}/members`)
        .send({ userId: bob.id })
        .expect(201);

      const promoted = await auth(app, alice)
        .patch(`/api/v1/chat/groups/${groupId}/members/${bob.id}`)
        .expect(200);
      expect(promoted.body.data.coAdminId).toBe(bob.id);

      const demoted = await auth(app, alice)
        .patch(`/api/v1/chat/groups/${groupId}/members/${bob.id}`)
        .expect(200);
      expect(demoted.body.data.coAdminId).toBeNull();

      await auth(app, alice)
        .patch(`/api/v1/chat/groups/${groupId}/members/${alice.id}`)
        .expect(400);
    });

    it('impede remover o admin do grupo', async () => {
      const group = await auth(app, alice)
        .post('/api/v1/chat/groups')
        .send({ name: 'Turma' })
        .expect(201);

      const res = await auth(app, alice)
        .delete(`/api/v1/chat/groups/${group.body.data.id}/members/${alice.id}`)
        .expect(400);
      expect(res.body.error).toContain('admin');
    });

    it('permite que um membro saia sozinho e limpa o co-admin', async () => {
      await makeFriends(app, alice, bob);
      const group = await auth(app, alice)
        .post('/api/v1/chat/groups')
        .send({ name: 'Turma' })
        .expect(201);
      const groupId = group.body.data.id;
      await auth(app, alice)
        .post(`/api/v1/chat/groups/${groupId}/members`)
        .send({ userId: bob.id })
        .expect(201);
      await auth(app, alice)
        .patch(`/api/v1/chat/groups/${groupId}/members/${bob.id}`)
        .expect(200);

      await auth(app, bob)
        .delete(`/api/v1/chat/groups/${groupId}/members/${bob.id}`)
        .expect(204);

      const updated = await prisma.chatGroup.findUniqueOrThrow({
        where: { id: groupId },
      });
      expect(updated.coAdminId).toBeNull();
    });

    it('troca mensagens no grupo', async () => {
      await makeFriends(app, alice, bob);
      const group = await auth(app, alice)
        .post('/api/v1/chat/groups')
        .send({ name: 'Turma' })
        .expect(201);
      const groupId = group.body.data.id;
      await auth(app, alice)
        .post(`/api/v1/chat/groups/${groupId}/members`)
        .send({ userId: bob.id })
        .expect(201);

      await auth(app, bob)
        .post(`/api/v1/chat/groups/${groupId}/messages`)
        .send({ content: 'Bom dia turma' })
        .expect(201);

      const messages = await auth(app, alice)
        .get(`/api/v1/chat/groups/${groupId}/messages`)
        .expect(200);
      expect(messages.body.data).toHaveLength(1);
      expect(messages.body.data[0]).toMatchObject({
        content: 'Bom dia turma',
        groupId,
        senderId: bob.id,
      });
    });
  });

  describe('Presence', () => {
    it('atualiza lastSeenAt', async () => {
      await auth(app, alice).post('/api/v1/presence').expect(200);

      const user = await prisma.user.findUniqueOrThrow({
        where: { id: alice.id },
      });
      expect(user.lastSeenAt).not.toBeNull();
      expect(Date.now() - user.lastSeenAt!.getTime()).toBeLessThan(10_000);
    });
  });
});
