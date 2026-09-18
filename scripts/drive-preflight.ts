import './load-local-env.ts';

import { createDriveClient } from '$lib/server/connectors/google-drive/client';
import { preflightGoogleDrive } from '$lib/server/connectors/google-drive/diagnose';

/**
 * A human-runnable (or one-off-ECS-task-runnable, once Dockerfile.mcp copies
 * scripts/) proof that the Google Drive connector actually works end to end: prints
 * the service-account email and one of the four preflight states plus remediation
 * text (ADR 0001 section 7 / section 8's "Implementation status").
 *
 * Usage: `pnpm run drive:preflight` with GOOGLE_DRIVE_SA_KEY_B64 and
 * GOOGLE_DRIVE_FOLDER_ID set in .env.local (see .env.example).
 */
async function main() {
	const keyBase64 = requireEnv('GOOGLE_DRIVE_SA_KEY_B64');
	const folderId = requireEnv('GOOGLE_DRIVE_FOLDER_ID');

	const client = createDriveClient(keyBase64);
	console.log(`Service account: ${client.serviceAccountEmail}`);
	console.log(`Folder id: ${folderId}`);

	const result = await preflightGoogleDrive(client, folderId);

	switch (result.status) {
		case 'ok':
			console.log(
				`OK — folder is shared and reachable (containerKind=${result.containerKind}, ` +
					`containerId=${result.containerId ?? 'n/a'}, containerName=${result.containerName ?? 'n/a'}).`
			);
			return;
		case 'auth_failed':
			console.error(`AUTH_FAILED — ${result.reason}`);
			console.error(
				'Remediation: verify the service-account key is current and unexpired, the system clock is correct, ' +
					'and the Drive API is enabled on the owning GCP project.'
			);
			break;
		case 'not_shared':
			console.error(`NOT_SHARED — ${result.reason}`);
			break;
		case 'shared_drive_membership_missing':
			console.error(`SHARED_DRIVE_MEMBERSHIP_MISSING — ${result.reason}`);
			break;
		case 'unreachable':
			console.error(`UNREACHABLE — ${result.reason}`);
			console.error('Remediation: check network egress to googleapis.com and retry.');
			break;
	}
	process.exitCode = 1;
}

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		console.error(`${name} is required. Set it in .env.local (see .env.example) before running this script.`);
		process.exit(1);
	}
	return value;
}

main().catch((error) => {
	console.error('drive-preflight failed unexpectedly:', error instanceof Error ? error.message : String(error));
	process.exit(1);
});
