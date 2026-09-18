-- CreateEnum
CREATE TYPE "DocumentSourceType" AS ENUM ('GOOGLE_DRIVE', 'S3_PREFIX');

-- CreateEnum
CREATE TYPE "DocumentIngestStatus" AS ENUM ('PENDING', 'FETCHED', 'PARSED', 'INDEXED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "DocumentSyncOutcome" AS ENUM ('OK', 'NOT_SHARED', 'EMPTY', 'AUTH_FAILED', 'SHARED_DRIVE_MEMBERSHIP_MISSING', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "DocumentSourceConnection" (
    "id" TEXT NOT NULL,
    "sourceType" "DocumentSourceType" NOT NULL,
    "label" TEXT NOT NULL,
    "externalRef" TEXT NOT NULL,
    "principal" TEXT NOT NULL,
    "lastPreflightStatus" TEXT,
    "lastPreflightAt" TIMESTAMP(3),
    "lastSyncStartedAt" TIMESTAMP(3),
    "lastSyncCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSourceConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "sourceType" "DocumentSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "remoteModifiedAt" TIMESTAMP(3),
    "contentHash" TEXT,
    "status" "DocumentIngestStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSyncRun" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "outcome" "DocumentSyncOutcome" NOT NULL,
    "filesSeen" INTEGER NOT NULL DEFAULT 0,
    "ingested" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DocumentSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSourceConnection_sourceType_externalRef_key" ON "DocumentSourceConnection"("sourceType", "externalRef");

-- CreateIndex
CREATE INDEX "Document_connectionId_idx" ON "Document"("connectionId");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Document_connectionId_sourceId_key" ON "Document"("connectionId", "sourceId");

-- CreateIndex
CREATE INDEX "DocumentChunk_documentId_idx" ON "DocumentChunk"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentChunk_documentId_ordinal_key" ON "DocumentChunk"("documentId", "ordinal");

-- CreateIndex
CREATE INDEX "DocumentSyncRun_connectionId_idx" ON "DocumentSyncRun"("connectionId");

-- CreateIndex
CREATE INDEX "DocumentSyncRun_startedAt_idx" ON "DocumentSyncRun"("startedAt");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "DocumentSourceConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSyncRun" ADD CONSTRAINT "DocumentSyncRun_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "DocumentSourceConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
-- Hand-added (not representable in prisma/schema.prisma without a functional-index
-- preview feature): supports the v1 full-text search in documents_search
-- (src/lib/server/mcp/tools.ts), which queries via to_tsvector(...) @@
-- plainto_tsquery(...) through $queryRaw tagged templates only. No pgvector, no
-- embeddings — see ADR 0001 section 5.
CREATE INDEX "DocumentChunk_text_fts_idx" ON "DocumentChunk" USING GIN (to_tsvector('english', "text"));
