const textLikeMimeTypes = new Set(['text/plain', 'text/markdown', 'text/csv', 'application/json', 'text/html']);

const extensionMimeTypes: Record<string, string> = {
	'.txt': 'text/plain',
	'.md': 'text/markdown',
	'.csv': 'text/csv',
	'.json': 'application/json',
	'.html': 'text/html',
	'.htm': 'text/html'
};

/**
 * `{ bytes, mimeType, title } -> text`. Deliberately narrow for v1: only the
 * plain-text-shaped MIME types a source adapter is expected to normalize into (see
 * connectors/google-drive/source.ts, which exports native Google types to text/plain
 * or text/csv before handing bytes here — so this function only ever sees ordinary
 * MIME types, never a Drive-specific one). `title`'s extension is a fallback only,
 * for a source that reports a generic type like application/octet-stream.
 *
 * Throws for anything else; the ingest orchestrator records that as a failed
 * document rather than aborting the whole sync.
 */
export function parseToText(input: { bytes: Uint8Array; mimeType: string; title: string }): string {
	const mimeType = resolveMimeType(input);
	if (!textLikeMimeTypes.has(mimeType)) {
		throw new Error(`Unsupported mime type for parsing: ${input.mimeType}`);
	}

	const decoded = new TextDecoder('utf-8').decode(input.bytes);
	return mimeType === 'text/html' ? stripHtml(decoded) : decoded;
}

function resolveMimeType(input: { mimeType: string; title: string }): string {
	if (textLikeMimeTypes.has(input.mimeType)) return input.mimeType;

	const dot = input.title.lastIndexOf('.');
	if (dot === -1) return input.mimeType;

	const extension = input.title.slice(dot).toLowerCase();
	return extensionMimeTypes[extension] ?? input.mimeType;
}

function stripHtml(html: string): string {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}
