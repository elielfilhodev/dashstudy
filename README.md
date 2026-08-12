# Dash Estudos

Aplicativo de controle de estudos: matérias, tarefas, agenda, metas, gamificação,
livraria e chat entre amigos.

Duas aplicações independentes no mesmo repositório:

| App | Stack | Porta | Pasta |
|---|---|---|---|
| Frontend | Next.js 16 (App Router, React 19, Tailwind 4, SWR) | 3000 | `/` |
| Backend | NestJS 11 + Prisma 5 + PostgreSQL | 4000 | `/backend` |

O frontend **não fala com o banco**. Todo acesso a dados passa pela API NestJS
em `/api/v1`. As rotas `/api/*` do Next são um proxy fino que anexa o access
token guardado em cookie httpOnly e renova a sessão automaticamente em caso
de 401.

---

## Rodando com Docker (recomendado)

```bash
cp .env.example .env
```

Ajuste ao menos `JWT_SECRET` (mínimo 32 caracteres) e então:

```bash
docker compose up
```

Sobe Postgres, backend (hot-reload, migrations aplicadas na subida) e frontend
(hot-reload). App em http://localhost:3000, API em http://localhost:4000/api/v1.

### Produção

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Diferenças do ambiente de produção: imagens compiladas (sem bind mount nem
hot-reload), Postgres sem porta publicada, `restart: unless-stopped`, cookies
com flag `Secure` e limites de memória.

---

## Rodando sem Docker

Precisa de um PostgreSQL acessível.

```bash
# Backend
cd backend
cp .env.example .env      # ajuste DATABASE_URL e JWT_SECRET
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run start:dev         # http://localhost:4000
```

```bash
# Frontend (noutro terminal, na raiz)
cp .env.example .env.local   # BACKEND_URL=http://localhost:4000
npm ci
npm run dev                  # http://localhost:3000
```

---

## Testes

```bash
cd backend
npm test                  # unitários (gamificação, auth, serialização)
```

Os testes e2e precisam de um Postgres dedicado:

```bash
docker compose -f docker-compose.test.yml up -d
cd backend && npm run prisma:deploy && npm run test:e2e
```

---

## Variáveis de ambiente

Cada app tem seu `.env.example` documentando as variáveis: `backend/.env.example`
para a API (banco, JWT, SMTP, OAuth, uploads) e `.env.example` na raiz para o
frontend e para o `docker-compose`.

Obrigatórias no backend: `DATABASE_URL` e `JWT_SECRET`. O restante é opcional e
degrada com elegância — sem SMTP o link de reset vai para o log em
desenvolvimento; sem credenciais do GitHub a rota OAuth responde 503; sem
`TENOR_API_KEY` a busca de GIFs responde 503.

---

## CI/CD

`.github/workflows/ci.yml` roda em todo push e PR:

1. **backend** — lint, type-check, testes unitários e e2e contra um Postgres de
   serviço, build.
2. **frontend** — lint, type-check, build.
3. **docker-build** — garante que as duas imagens de produção constroem.
4. **publish** — em push para `main`, publica as imagens no GHCR.
5. **preview-gate** — trava o merge de PRs para `main` até tudo passar.

---

## Estrutura

```
backend/
  prisma/schema.prisma       fonte da verdade do modelo de dados
  src/
    common/                  config, Prisma, guards, filtros, schemas Zod, utils
    modules/
      auth/                  registro, login, refresh rotacionado, OAuth GitHub
      users/                 perfil, banner, senha, heatmap de atividade
      study/                 matérias, tarefas, metas, agenda, gamificação
      friends/               amizades e perfis públicos
      books/                 livraria com anotações e comentários
      chat/                  DMs, grupos e upload de anexos
      misc/                  presença e proxy de GIFs
  test/                      suíte e2e (Supertest)

src/
  app/
    (auth)/                  login, registro, reset de senha
    (dashboard)/             páginas protegidas
    api/[...path]/           proxy para a API NestJS
    api/auth/                pontes que manipulam os cookies de sessão
  components/                UI por domínio
  lib/
    backend.ts               cliente HTTP da API (servidor)
    session.ts               sessão no servidor (RSC)
    session-client.tsx       sessão no cliente (useSession/signIn/signOut)
    auth-cookies.ts          leitura e escrita dos cookies httpOnly
```
