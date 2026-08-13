-- Colunas de anexo em Message.
--
-- Elas fazem parte da migration 20260401000000_backfill_push_only_changes, mas
-- o banco de produção foi criado por `prisma db push` e depois baselinado
-- (`migrate resolve --applied`), então aquela migration ficou registrada com
-- zero passos executados e as colunas nunca chegaram a existir lá. Sem elas
-- todo `prisma.message.*` quebra: enviar mensagem, abrir a conversa e listar
-- as conversas do chat.
--
-- Idempotente: é um no-op nos bancos que já têm as colunas.

ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "attachmentType" TEXT,
  ADD COLUMN IF NOT EXISTS "attachmentName" TEXT;

-- `content` é opcional quando a mensagem tem só anexo (default "" no schema).
ALTER TABLE "Message" ALTER COLUMN "content" SET DEFAULT '';
