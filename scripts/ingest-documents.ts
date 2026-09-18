import './load-local-env.ts';

import { buildDocumentSourceFromEnv } from '$lib/server/connectors/registry';
import { ingestSource } from '$lib/server/documents/ingest';

/**
 * The one-off ingestion entrypoint (ADR 0001 section 6: "Ingestion is not an MCP
 * tool ... It runs as a one-off ECS task (later, a scheduled task) using the MCP
 * image"). Not wired into any MCP tool — it writes, and MCP tools are read-only.
 *
 * Usage: `pnpm run documents:ingest` with the configured source's env keys set (see
 * .env.example and src/lib/server/connectors/registry.ts).
 */
async function main() {
	const source = buildDocumentSourceFromEnv();
	const summary = await ingestSource(source);
	console.log(`Ingestion complete: ${JSON.stringify(summary)}`);

	const failureOutcomes = new Set(['FAILED', 'AUTH_FAILED', 'NOT_SHARED', 'SHARED_DRIVE_MEMBERSHIP_MISSING']);
	if (failureOutcomes.has(summary.outcome)) {
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error('ingest-documents failed unexpectedly:', error instanceof Error ? error.message : String(error));
	process.exit(1);
});
