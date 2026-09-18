import { existsSync } from 'node:fs';

// Must be imported first, and must have no other imports of its own — see
// src/mcp-server/load-env.ts for the same pattern and the reason (ES module imports
// evaluate in source order before any of an importing file's own top-level code, so a
// side-effecting loader has to be its own file, imported ahead of anything — like
// $lib/server/prisma or $lib/server/connectors/registry — that reads process.env at
// import time). Shared by scripts/drive-preflight.ts and scripts/ingest-documents.ts.
if (existsSync('.env.local')) {
	process.loadEnvFile('.env.local');
}
