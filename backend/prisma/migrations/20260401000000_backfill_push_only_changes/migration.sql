-- Amizades, chat e colunas de perfil/tarefa.
--
-- Estes objetos existiam apenas via `prisma db push` e nunca entraram no
-- histórico de migrations, então um banco novo quebrava na migration seguinte
-- (que cria MessageReadReceipt referenciando "Message"). Tudo aqui é
-- idempotente para ser um no-op nos bancos que já foram atualizados por push.

-- Horário opcional da tarefa ---------------------------------------------------

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "scheduledTime" TEXT;

-- Campos de perfil e presença no User -----------------------------------------

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "username" TEXT,
  ADD COLUMN IF NOT EXISTS "displayId" TEXT,
  ADD COLUMN IF NOT EXISTS "bannerUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "bannerMime" TEXT,
  ADD COLUMN IF NOT EXISTS "bannerBlob" BYTEA,
  ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);

-- displayId é NOT NULL: preenche as linhas anteriores à coluna com o mesmo
-- formato usado pela aplicação (6 caracteres alfanuméricos maiúsculos).
UPDATE "User"
  SET "displayId" = upper(substr(md5(random()::text || "id"), 1, 6))
  WHERE "displayId" IS NULL;

ALTER TABLE "User" ALTER COLUMN "displayId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "User_displayId_key" ON "User"("displayId");

-- Amizades ---------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'BLOCKED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "Friendship" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Friendship_senderId_receiverId_key"
  ON "Friendship"("senderId", "receiverId");

DO $$ BEGIN
    ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_senderId_fkey"
      FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_receiverId_fkey"
      FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Grupos de chat ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "ChatGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "adminId" TEXT NOT NULL,
    "coAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatGroup_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "ChatGroup" ADD CONSTRAINT "ChatGroup_adminId_fkey"
      FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "ChatGroup" ADD CONSTRAINT "ChatGroup_coAdminId_fkey"
      FOREIGN KEY ("coAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ChatGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatGroupMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChatGroupMember_groupId_userId_key"
  ON "ChatGroupMember"("groupId", "userId");
CREATE INDEX IF NOT EXISTS "ChatGroupMember_userId_idx" ON "ChatGroupMember"("userId");

DO $$ BEGIN
    ALTER TABLE "ChatGroupMember" ADD CONSTRAINT "ChatGroupMember_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "ChatGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "ChatGroupMember" ADD CONSTRAINT "ChatGroupMember_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Mensagens --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "attachmentUrl" TEXT,
    "attachmentType" TEXT,
    "attachmentName" TEXT,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT,
    "groupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- Bancos que receberam a tabela por push antes dos anexos podem não ter estas colunas.
ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "attachmentType" TEXT,
  ADD COLUMN IF NOT EXISTS "attachmentName" TEXT;

CREATE INDEX IF NOT EXISTS "Message_senderId_idx" ON "Message"("senderId");
CREATE INDEX IF NOT EXISTS "Message_recipientId_idx" ON "Message"("recipientId");
CREATE INDEX IF NOT EXISTS "Message_groupId_idx" ON "Message"("groupId");

DO $$ BEGIN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey"
      FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_recipientId_fkey"
      FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "ChatGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
