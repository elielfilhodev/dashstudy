import { PrismaClient } from "@prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import { Pool } from "@neondatabase/serverless"

declare global {
  // biome-ignore lint: needed for global singleton
  var __prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV === "production" || process.env.USE_NEON_ADAPTER === "true") {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
    const adapter = new PrismaNeon(pool)
    return new PrismaClient({
      adapter,
      log: ["error"],
    })
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })
}

// Singleton: avoids exhausting DB connections during hot reload in dev
export const db: PrismaClient =
  globalThis.__prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = db
}
