import { logConnectorEvent } from '../../documents/log';
import type { PreflightResult } from '../../documents/types';
import { DriveAuthError, extractDriveErrorReason, type DriveClient } from './client';

type DriveFolderMetadata = { id: string; name?: string; driveId?: string };
type DriveMetadata = { id: string; name?: string };

/**
 * The three-state Drive preflight, in the exact detection order from ADR 0001
 * section 7 — this ordering is what makes the states separable from our logs alone:
 *
 *  1. Token exchange failure -> auth_failed.
 *  2. `GET /files/{folderId}?fields=id,name,driveId,mimeType&supportsAllDrives=true`
 *     - 404 -> not_shared. Drive deliberately returns 404 (not 403) for a resource
 *       the caller cannot see, so this is the not-shared signal.
 *     - 403 -> auth_failed, with the distinguishing reason code.
 *     - 200 with `driveId` present -> the folder is in a Shared Drive. Probe
 *       `GET /drives/{driveId}`; a 404 there means the service account is not a
 *       member of the Shared Drive -> shared_drive_membership_missing. This is the
 *       silent failure: sharing the subfolder alone can appear to succeed while
 *       listing returns nothing.
 *     - 200 without `driveId` -> a My Drive folder shared directly -> ok.
 *
 * Listing children — and the resulting `empty` outcome once preflight is already
 * `ok` — happens in source.ts / documents/ingest.ts, not here (ADR section 7 step 3).
 */
export async function preflightGoogleDrive(client: DriveClient, folderId: string): Promise<PreflightResult> {
	const principal = client.serviceAccountEmail;

	let folderResponse: Response;
	try {
		folderResponse = await client.driveFetch(
			`/files/${encodeURIComponent(folderId)}?fields=id,name,driveId,mimeType&supportsAllDrives=true`
		);
	} catch (error) {
		if (error instanceof DriveAuthError) {
			logConnectorEvent('GOOGLE_DRIVE', 'preflight.auth_failed', {
				principal,
				googleErrorCode: error.googleErrorCode,
				httpStatus: error.httpStatus
			});
			return { status: 'auth_failed', principal, reason: error.googleErrorCode };
		}
		return { status: 'unreachable', principal, reason: error instanceof Error ? error.message : 'network_error' };
	}

	if (folderResponse.status === 404) {
		logConnectorEvent('GOOGLE_DRIVE', 'preflight.not_shared', { principal, folderId, httpStatus: 404 });
		return { status: 'not_shared', principal, reason: `Share folder ${folderId} with ${principal} as Viewer` };
	}

	if (folderResponse.status === 403) {
		const googleErrorCode = await extractDriveErrorReason(folderResponse);
		logConnectorEvent('GOOGLE_DRIVE', 'preflight.auth_failed', { principal, googleErrorCode, httpStatus: 403 });
		return { status: 'auth_failed', principal, reason: googleErrorCode };
	}

	if (!folderResponse.ok) {
		return { status: 'unreachable', principal, reason: `unexpected_status_${folderResponse.status}` };
	}

	const folder = (await folderResponse.json()) as DriveFolderMetadata;

	if (folder.driveId) {
		let driveResponse: Response;
		try {
			driveResponse = await client.driveFetch(`/drives/${encodeURIComponent(folder.driveId)}`);
		} catch (error) {
			return { status: 'unreachable', principal, reason: error instanceof Error ? error.message : 'network_error' };
		}

		if (driveResponse.status === 404) {
			logConnectorEvent('GOOGLE_DRIVE', 'preflight.shared_drive_membership_missing', {
				principal,
				driveId: folder.driveId,
				folderId
			});
			return {
				status: 'shared_drive_membership_missing',
				principal,
				reason: `Add ${principal} as a member of Shared Drive ${folder.driveId}; sharing the subfolder alone is not sufficient`
			};
		}

		if (!driveResponse.ok) {
			return { status: 'unreachable', principal, reason: `unexpected_status_${driveResponse.status}` };
		}

		const drive = (await driveResponse.json()) as DriveMetadata;
		logConnectorEvent('GOOGLE_DRIVE', 'preflight.ok', {
			principal,
			containerKind: 'shared_drive',
			containerId: drive.id,
			containerName: drive.name ?? null,
			driveId: drive.id
		});
		return { status: 'ok', principal, containerKind: 'shared_drive', containerId: drive.id, containerName: drive.name ?? null };
	}

	logConnectorEvent('GOOGLE_DRIVE', 'preflight.ok', {
		principal,
		containerKind: 'my_drive',
		containerId: folder.id,
		containerName: folder.name ?? null,
		driveId: null
	});
	return { status: 'ok', principal, containerKind: 'my_drive', containerId: folder.id, containerName: folder.name ?? null };
}
