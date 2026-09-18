import type { DocumentSource, PreflightResult, SourceDocument, SourceType } from '../../documents/types';
import type { DriveClient } from './client';
import { preflightGoogleDrive } from './diagnose';

type DriveFile = {
	id: string;
	name: string;
	mimeType: string;
	modifiedTime?: string;
	size?: string;
	md5Checksum?: string;
};

// Native Google types have no downloadable bytes; `files.get?alt=media` 404s on them.
// They must go through `files.export` instead, normalized to an ordinary MIME type
// before parse.ts ever sees them (ADR 0001 section 4).
const nativeGoogleExportMimeTypes: Record<string, string> = {
	'application/vnd.google-apps.document': 'text/plain',
	'application/vnd.google-apps.spreadsheet': 'text/csv',
	'application/vnd.google-apps.presentation': 'text/plain'
};

const driveSourceType: SourceType = 'GOOGLE_DRIVE';

/** Builds the source-agnostic `DocumentSource` contract for one Drive folder. */
export function createGoogleDriveSource(client: DriveClient, folderId: string): DocumentSource {
	return {
		sourceType: driveSourceType,
		describe() {
			return { principal: client.serviceAccountEmail, externalRef: folderId };
		},
		preflight(): Promise<PreflightResult> {
			return preflightGoogleDrive(client, folderId);
		},
		async listDocuments(): Promise<SourceDocument[]> {
			const files = await listChildren(client, folderId);
			return files.map((file) => toSourceDocument(client, file));
		}
	};
}

async function listChildren(client: DriveClient, folderId: string): Promise<DriveFile[]> {
	const files: DriveFile[] = [];
	let pageToken: string | undefined;

	do {
		const params = new URLSearchParams({
			q: `'${folderId}' in parents and trashed = false`,
			fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,size,md5Checksum)',
			// Both flags are required independently — omitting either is an
			// independent cause of a silently empty list on Shared Drives
			// (ADR 0001 section 7 step 3).
			supportsAllDrives: 'true',
			includeItemsFromAllDrives: 'true',
			pageSize: '1000'
		});
		if (pageToken) params.set('pageToken', pageToken);

		const response = await client.driveFetch(`/files?${params.toString()}`);
		if (!response.ok) throw new Error(`Failed to list Drive folder children: HTTP ${response.status}`);

		const body = (await response.json()) as { files?: DriveFile[]; nextPageToken?: string };
		files.push(...(body.files ?? []));
		pageToken = body.nextPageToken;
	} while (pageToken);

	return files;
}

function toSourceDocument(client: DriveClient, file: DriveFile): SourceDocument {
	const exportMimeType = nativeGoogleExportMimeTypes[file.mimeType];

	return {
		sourceType: driveSourceType,
		sourceId: file.id,
		title: file.name,
		mimeType: exportMimeType ?? file.mimeType,
		sizeBytes: file.size ? Number(file.size) : null,
		remoteModifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : null,
		contentHash: file.md5Checksum ?? null,
		async fetchContent() {
			const path = exportMimeType
				? `/files/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent(exportMimeType)}`
				: `/files/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`;

			const response = await client.driveFetch(path);
			if (!response.ok) throw new Error(`Failed to fetch Drive file ${file.id}: HTTP ${response.status}`);

			const bytes = new Uint8Array(await response.arrayBuffer());
			return { bytes, mimeType: exportMimeType ?? file.mimeType };
		}
	};
}
