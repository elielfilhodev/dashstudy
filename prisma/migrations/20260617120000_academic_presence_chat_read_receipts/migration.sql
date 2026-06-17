-- Academic identity, richer presence and read receipts.

DO $$ BEGIN
    CREATE TYPE "AcademicLevel" AS ENUM ('GRADUACAO', 'MESTRADO', 'DOUTORADO', 'TECNOLOGO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PresenceStatus" AS ENUM ('ONLINE', 'AWAY', 'OFFLINE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "presenceStatus" "PresenceStatus" NOT NULL DEFAULT 'OFFLINE',
  ADD COLUMN IF NOT EXISTS "presenceUpdatedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "Course" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "crestIcon" TEXT NOT NULL DEFAULT 'graduation-cap',
    "crestColor" TEXT NOT NULL DEFAULT '#0f766e',
    "crestBackground" TEXT NOT NULL DEFAULT '#ecfeff',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AcademicProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "academicLevel" "AcademicLevel" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "currentSemester" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MessageReadReceipt" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReadReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Course_normalizedName_key" ON "Course"("normalizedName");
CREATE UNIQUE INDEX IF NOT EXISTS "Course_slug_key" ON "Course"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "AcademicProfile_userId_key" ON "AcademicProfile"("userId");
CREATE INDEX IF NOT EXISTS "AcademicProfile_courseId_idx" ON "AcademicProfile"("courseId");
CREATE INDEX IF NOT EXISTS "AcademicProfile_academicLevel_idx" ON "AcademicProfile"("academicLevel");
CREATE UNIQUE INDEX IF NOT EXISTS "MessageReadReceipt_messageId_userId_key" ON "MessageReadReceipt"("messageId", "userId");
CREATE INDEX IF NOT EXISTS "MessageReadReceipt_userId_readAt_idx" ON "MessageReadReceipt"("userId", "readAt");

DO $$ BEGIN
    ALTER TABLE "AcademicProfile" ADD CONSTRAINT "AcademicProfile_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "AcademicProfile" ADD CONSTRAINT "AcademicProfile_courseId_fkey"
      FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "MessageReadReceipt" ADD CONSTRAINT "MessageReadReceipt_messageId_fkey"
      FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "MessageReadReceipt" ADD CONSTRAINT "MessageReadReceipt_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
