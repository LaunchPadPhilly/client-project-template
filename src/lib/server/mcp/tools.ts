import { z } from 'zod';
import { prisma } from '$lib/server/prisma';
import type { McpToolDefinition } from '$lib/server/mcp/handler';

/**
 * The tools this deployment exposes over MCP. Both entry points import this list
 * (src/mcp-server/index.ts and src/routes/api/mcp/+server.ts), so adding a tool here
 * adds it everywhere.
 *
 * Rules for every tool, enforced by review rather than by the type system:
 *  - Read-only. No INSERT/UPDATE/DELETE/DROP, and no side effects in an upstream API.
 *  - Parameterized queries only. Prisma's query builder does this; `$queryRaw` must use
 *    tagged-template parameters, never string interpolation.
 *  - Validate input with the Zod shape; the handler receives the parsed object.
 *  - Never return secrets, raw upstream payloads, or another user's private data.
 *
 * `service_status` is the shipped example: it demonstrates the scope gate, the input
 * schema, and the JSON result shape without inventing a domain. The `documents_*`
 * tools below (ADR 0001) are the first real domain tools; ingestion itself is
 * deliberately not a tool since it writes — see scripts/ingest-documents.ts.
 *
 * `mcpTools`'s explicit `readonly McpToolDefinition[]` element type (rather than one
 * inferred per tool) means the SDK-facing `inputSchema` shape is checked at runtime by
 * the MCP server regardless, but a handler cannot rely on TypeScript having narrowed
 * its own `input` beyond that shared default. Tools that need typed access re-parse
 * their own already-validated input with their own Zod object below — cheap,
 * always-valid at runtime, and it keeps the handler body itself type-safe without
 * touching src/lib/server/mcp/handler.ts.
 */
const documentsSearchInput = {
	query: z.string().min(1).max(500).describe('Search text.'),
	limit: z.number().int().min(1).max(50).optional().describe('Maximum results to return. Defaults to 20.')
};
const documentsSearchSchema = z.object(documentsSearchInput);

const documentGetInput = {
	documentId: z.string().min(1).describe('The internal Document id, as returned by documents_search.')
};
const documentGetSchema = z.object(documentGetInput);

export const mcpTools: readonly McpToolDefinition[] = [
	{
		name: 'service_status',
		description:
			'Read-only health summary of this data service: counts of registered users and active data scopes. ' +
			"Example question: 'is the data service up and who can use it?' → {}. " +
			'Returns { status, users, activeScopeGrants, checkedAt }.',
		inputSchema: {
			includeCounts: z
				.boolean()
				.optional()
				.describe('Set false to skip the database counts and return liveness only.')
		},
		requiredScope: 'DATA_READ',
		handler: async ({ includeCounts = true }) => {
			if (!includeCounts) return { status: 'ok', checkedAt: new Date().toISOString() };
			const [users, activeScopeGrants] = await Promise.all([
				prisma.user.count(),
				prisma.mcpUserScopeGrant.count({ where: { revokedAt: null } })
			]);
			return { status: 'ok', users, activeScopeGrants, checkedAt: new Date().toISOString() };
		}
	},
	{
		name: 'documents_search',
		description:
			'Full-text search over ingested document chunks (Google Drive today; source-agnostic storage). ' +
			"Example question: 'find documents about after-school attendance' → { query: 'after-school attendance' }. " +
			'Returns { results: [{ documentId, title, sourceType, ordinal, snippet }] }.',
		inputSchema: documentsSearchInput,
		requiredScope: 'DOCUMENTS_READ',
		handler: async (rawInput) => {
			const { query, limit = 20 } = documentsSearchSchema.parse(rawInput);
			const results = await prisma.$queryRaw<
				Array<{ documentId: string; title: string; sourceType: string; ordinal: number; snippet: string }>
			>`
				SELECT
					d.id AS "documentId",
					d.title,
					d."sourceType"::text AS "sourceType",
					c.ordinal,
					ts_headline('english', c.text, plainto_tsquery('english', ${query}), 'MaxFragments=1,MaxWords=30') AS snippet
				FROM "DocumentChunk" c
				JOIN "Document" d ON d.id = c."documentId"
				WHERE to_tsvector('english', c.text) @@ plainto_tsquery('english', ${query})
				ORDER BY ts_rank(to_tsvector('english', c.text), plainto_tsquery('english', ${query})) DESC
				LIMIT ${limit}
			`;
			return { results };
		}
	},
	{
		name: 'document_get',
		description:
			"Fetch one document's metadata and full extracted text by its internal id (as returned by documents_search). " +
			"Example question: 'show me document doc_abc123' → { documentId: 'doc_abc123' }. " +
			'Returns { document: { id, title, sourceType, mimeType, status, remoteModifiedAt, failureReason }, text }.',
		inputSchema: documentGetInput,
		requiredScope: 'DOCUMENTS_READ',
		handler: async (rawInput) => {
			const { documentId } = documentGetSchema.parse(rawInput);
			const document = await prisma.document.findUnique({
				where: { id: documentId },
				include: { chunks: { orderBy: { ordinal: 'asc' } } }
			});
			if (!document) throw new Error('Document not found');

			return {
				document: {
					id: document.id,
					title: document.title,
					sourceType: document.sourceType,
					mimeType: document.mimeType,
					status: document.status,
					remoteModifiedAt: document.remoteModifiedAt,
					failureReason: document.failureReason
				},
				text: document.chunks.map((chunk) => chunk.text).join('\n\n')
			};
		}
	},
	{
		name: 'document_source_status',
		description:
			'Operator health check for every configured document source: its principal (e.g. a service-account email), ' +
			"the last preflight result, and the most recent sync run's outcome and counts. " +
			"Example question: 'is the Drive connector working?' → {}. " +
			'Returns { connections: [{ label, sourceType, principal, externalRef, lastPreflightStatus, lastPreflightAt, lastSync }] }.',
		inputSchema: {},
		requiredScope: 'DOCUMENTS_READ',
		handler: async () => {
			const connections = await prisma.documentSourceConnection.findMany({
				include: { syncRuns: { orderBy: { startedAt: 'desc' }, take: 1 } }
			});

			return {
				connections: connections.map((connection) => ({
					label: connection.label,
					sourceType: connection.sourceType,
					principal: connection.principal,
					externalRef: connection.externalRef,
					lastPreflightStatus: connection.lastPreflightStatus,
					lastPreflightAt: connection.lastPreflightAt,
					lastSync: connection.syncRuns[0]
						? {
								outcome: connection.syncRuns[0].outcome,
								filesSeen: connection.syncRuns[0].filesSeen,
								ingested: connection.syncRuns[0].ingested,
								failed: connection.syncRuns[0].failed,
								completedAt: connection.syncRuns[0].completedAt
							}
						: null
				}))
			};
		}
	}
];
