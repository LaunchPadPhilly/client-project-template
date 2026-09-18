import { prisma } from '$lib/server/prisma';
import { chunkText } from './chunk';
import { logConnectorEvent } from './log';
import { parseToText } from './parse';
import type { DocumentSource, PreflightResult, SourceDocument } from './types';

export type IngestOutcome = 'OK' | 'NOT_SHARED' | 'EMPTY' | 'AUTH_FAILED' | 'SHARED_DRIVE_MEMBERSHIP_MISSING' | 'PARTIAL' | 'FAILED';

export type IngestSummary = {
	outcome: IngestOutcome;
	filesSeen: number;
	ingested: number;
	failed: number;
};

/**
 * The orchestrator: preflight -> listDocuments -> parse -> chunk -> persist (ADR
 * 0001, "Source-agnostic ingestion"). Takes an already-built `DocumentSource` so this
 * module never has to know which adapter it is driving — the caller
 * (scripts/ingest-documents.ts) builds the source from src/lib/server/connectors/registry.ts.
 *
 * Not an MCP tool: it writes, and MCP tools are read-only. It is meant to run as a
 * one-off (later, scheduled) ECS task using the MCP image.
 */
export async function ingestSource(source: DocumentSource): Promise<IngestSummary> {
	const { principal, externalRef } = source.describe();

	const connection = await prisma.documentSourceConnection.upsert({
		where: { sourceType_externalRef: { sourceType: source.sourceType, externalRef } },
		create: { sourceType: source.sourceType, externalRef, principal, label: externalRef },
		update: { principal }
	});

	await prisma.documentSourceConnection.update({
		where: { id: connection.id },
		data: { lastSyncStartedAt: new Date() }
	});

	const preflight = await source.preflight();

	await prisma.documentSourceConnection.update({
		where: { id: connection.id },
		data: { lastPreflightStatus: preflight.status, lastPreflightAt: new Date() }
	});

	if (preflight.status !== 'ok') {
		const outcome = mapPreflightFailureToOutcome(preflight);
		await recordSyncRun(connection.id, outcome, { filesSeen: 0, ingested: 0, failed: 0 });
		return { outcome, filesSeen: 0, ingested: 0, failed: 0 };
	}

	const documents = await source.listDocuments();
	const filesSeen = documents.length;
	let ingested = 0;
	let failed = 0;

	for (const document of documents) {
		try {
			await ingestOneDocument(connection.id, document);
			ingested++;
		} catch (error) {
			failed++;
			await recordFailedDocument(connection.id, document, error);
		}
	}

	const outcome: IngestOutcome = filesSeen === 0 ? 'EMPTY' : failed > 0 && ingested === 0 ? 'FAILED' : failed > 0 ? 'PARTIAL' : 'OK';

	await recordSyncRun(connection.id, outcome, { filesSeen, ingested, failed });
	logConnectorEvent(source.sourceType, filesSeen === 0 ? 'sync.empty' : 'sync.ok', {
		principal,
		externalRef,
		filesSeen,
		ingested,
		failed
	});

	return { outcome, filesSeen, ingested, failed };
}

function mapPreflightFailureToOutcome(preflight: Exclude<PreflightResult, { status: 'ok' }>): IngestOutcome {
	switch (preflight.status) {
		case 'auth_failed':
			return 'AUTH_FAILED';
		case 'not_shared':
			return 'NOT_SHARED';
		case 'shared_drive_membership_missing':
			return 'SHARED_DRIVE_MEMBERSHIP_MISSING';
		case 'unreachable':
			return 'FAILED';
	}
}

async function recordSyncRun(
	connectionId: string,
	outcome: IngestOutcome,
	counts: { filesSeen: number; ingested: number; failed: number }
) {
	await prisma.documentSyncRun.create({
		data: { connectionId, outcome, ...counts, completedAt: new Date() }
	});
	await prisma.documentSourceConnection.update({
		where: { id: connectionId },
		data: { lastSyncCompletedAt: new Date() }
	});
}

async function ingestOneDocument(connectionId: string, doc: SourceDocument) {
	const { bytes, mimeType } = await doc.fetchContent();
	const text = parseToText({ bytes, mimeType, title: doc.title });
	const chunks = chunkText(text);

	const document = await prisma.document.upsert({
		where: { connectionId_sourceId: { connectionId, sourceId: doc.sourceId } },
		create: {
			connectionId,
			sourceType: doc.sourceType,
			sourceId: doc.sourceId,
			title: doc.title,
			mimeType,
			sizeBytes: doc.sizeBytes,
			remoteModifiedAt: doc.remoteModifiedAt,
			contentHash: doc.contentHash,
			status: 'INDEXED'
		},
		update: {
			title: doc.title,
			mimeType,
			sizeBytes: doc.sizeBytes,
			remoteModifiedAt: doc.remoteModifiedAt,
			contentHash: doc.contentHash,
			status: 'INDEXED',
			failureReason: null
		}
	});

	await prisma.documentChunk.deleteMany({ where: { documentId: document.id } });
	if (chunks.length > 0) {
		await prisma.documentChunk.createMany({
			data: chunks.map((chunk) => ({
				documentId: document.id,
				ordinal: chunk.ordinal,
				text: chunk.text,
				tokenCount: chunk.tokenCount
			}))
		});
	}
}

async function recordFailedDocument(connectionId: string, doc: SourceDocument, error: unknown) {
	const failureReason = error instanceof Error ? error.message : 'unknown_error';
	await prisma.document.upsert({
		where: { connectionId_sourceId: { connectionId, sourceId: doc.sourceId } },
		create: {
			connectionId,
			sourceType: doc.sourceType,
			sourceId: doc.sourceId,
			title: doc.title,
			mimeType: doc.mimeType,
			sizeBytes: doc.sizeBytes,
			remoteModifiedAt: doc.remoteModifiedAt,
			contentHash: doc.contentHash,
			status: 'FAILED',
			failureReason
		},
		update: { status: 'FAILED', failureReason }
	});
}
