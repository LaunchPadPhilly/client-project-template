import type { SourceType } from './types';

const logPrefixBySourceType: Record<SourceType, string> = {
	GOOGLE_DRIVE: 'drive',
	S3_PREFIX: 's3'
};

/**
 * Single-line JSON connector log events to stdout (CloudWatch's `mcp` stream in ECS).
 * This is the diagnostic channel by necessity: `toolResult` in
 * src/lib/server/mcp/handler.ts catches every error and returns a fixed string, so an
 * MCP tool response can never carry Drive/S3 diagnostics. `document_source_status`
 * (an MCP tool) reads the durable record of these events from `DocumentSyncRun`
 * instead of parsing logs.
 *
 * Never pass a key, a JWT assertion, an access token, or a raw upstream payload as a
 * field — only short codes and identifiers (ADR 0001 section 7).
 */
export function logConnectorEvent(sourceType: SourceType, event: string, fields: Record<string, unknown> = {}) {
	const line = {
		event: `${logPrefixBySourceType[sourceType]}.${event}`,
		...fields,
		loggedAt: new Date().toISOString()
	};
	console.log(JSON.stringify(line));
}
