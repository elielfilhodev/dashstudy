-- Tokens de refresh do backend Go (hash armazenado, não o token em claro)
CREATE TABLE IF NOT EXISTS "GoRefreshToken" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "GoRefreshToken_userId_idx" ON "GoRefreshToken" ("userId");
CREATE INDEX IF NOT EXISTS "GoRefreshToken_expiresAt_idx" ON "GoRefreshToken" ("expiresAt");
