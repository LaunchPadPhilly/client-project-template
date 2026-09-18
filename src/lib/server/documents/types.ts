/**
 * The source-agnostic ingestion contract (ADR 0001, "Source-agnostic ingestion,
 * because the share is untested"). Nothing in this directory may import from
 * src/lib/server/connectors/ — the dependency arrow points one way: connectors
 * import this contract, the contract never imports a connector. Swapping the
 * Google Drive adapter for the S3 fallback changes only
 * src/lib/server/connectors/registry.ts.
 */

/** Matches the Prisma `DocumentSourceType` enum values exactly (see prisma/schema.prisma). */
export type SourceType = 'GOOGLE_DRIVE' | 'S3_PREFIX';

/**
 * One document as seen by a source, before parsing. `fetchContent` is lazy — listing
 * a large folder must never download it; only the ingest orchestrator calls
 * `fetchContent`, once per document it has decided to ingest.
 */
export type SourceDocument = {
	sourceType: SourceType;
	/** The id in the source's own namespace (Drive file id, S3 object key, ...). */
	sourceId: string;
	title: string;
	/**
	 * An ordinary MIME type. Provider quirks are absorbed by the adapter before this
	 * point — e.g. the Drive adapter normalizes native Google types
	 * (application/vnd.google-apps.document) to a standard type via `files/export`
	 * before parse.ts ever sees them.
	 */
	mimeType: string;
	sizeBytes: number | null;
	remoteModifiedAt: Date | null;
	contentHash: string | null;
	fetchContent: () => Promise<{ bytes: Uint8Array; mimeType: string }>;
};

/**
 * The preflight states a source can report. `ok` and the three named failure states
 * are the ones a share/permission problem produces (see
 * src/lib/server/connectors/google-drive/diagnose.ts for the exact detection order);
 * `unreachable` is the catch-all for a network-level failure that never got an HTTP
 * answer to classify.
 */
export type PreflightResult =
	| { status: 'ok'; principal: string; containerKind: string; containerId: string | null; containerName: string | null }
	| { status: 'auth_failed'; principal: string; reason: string }
	| { status: 'not_shared'; principal: string; reason: string }
	| { status: 'shared_drive_membership_missing'; principal: string; reason: string }
	| { status: 'unreachable'; principal: string; reason: string };

/**
 * The seam every parsing/chunking/indexing/orchestration code depends on instead of a
 * concrete connector. `describe()` always returns the principal (e.g. a
 * service-account email) so operator-facing surfaces (document_source_status) never
 * need a source-specific special case.
 */
export type DocumentSource = {
	sourceType: SourceType;
	describe(): { principal: string; externalRef: string };
	preflight(): Promise<PreflightResult>;
	listDocuments(): Promise<SourceDocument[]>;
};
