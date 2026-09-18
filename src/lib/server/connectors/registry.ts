import type { DocumentSource } from '../documents/types';
import { createDriveClient } from './google-drive/client';
import { createGoogleDriveSource } from './google-drive/source';

/**
 * The only module in this repo that knows both the source-agnostic document contract
 * (src/lib/server/documents/) and a concrete connector adapter (ADR 0001 section 4).
 * Builds a `DocumentSource` from the environment.
 *
 * Reads `process.env` directly, never `$env/*` — this module is imported by the
 * standalone ingestion entrypoint (scripts/ingest-documents.ts / scripts/drive-preflight.ts),
 * which runs outside SvelteKit's request-scoped env resolution, same as the rest of
 * src/lib/server/connectors/ and src/lib/server/documents/.
 */
export function buildDocumentSourceFromEnv(): DocumentSource {
	const kind = process.env.DOCUMENT_SOURCE_KIND ?? 'google_drive';

	switch (kind) {
		case 'google_drive':
			return buildGoogleDriveSource();
		case 's3':
			// ADR 0001 section 4: the S3 fallback adapter is built only if the Google
			// Drive share turns out to be blocked. The seam exists (the DocumentSource
			// contract, and the reserved DOCUMENT_SOURCE_S3_BUCKET/PREFIX keys); the
			// adapter itself (src/lib/server/connectors/s3-prefix/source.ts) does not.
			throw new Error(
				'DOCUMENT_SOURCE_KIND=s3 is not implemented. Per docs/decisions/0001-google-drive-service-account-connector.md ' +
					'section 4, build src/lib/server/connectors/s3-prefix/source.ts only if the Drive share is confirmed blocked.'
			);
		default:
			throw new Error(`Unknown DOCUMENT_SOURCE_KIND: ${kind}`);
	}
}

function buildGoogleDriveSource(): DocumentSource {
	const keyBase64 = requireEnv('GOOGLE_DRIVE_SA_KEY_B64');
	const folderId = requireEnv('GOOGLE_DRIVE_FOLDER_ID');
	const client = createDriveClient(keyBase64);
	return createGoogleDriveSource(client, folderId);
}

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is required to build the configured document source`);
	return value;
}
