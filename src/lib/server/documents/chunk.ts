export type TextChunk = { ordinal: number; text: string; tokenCount: number };

const maxChunkChars = 4000;
// English text averages roughly 4 characters per token. There is no embeddings step
// in v1 (ADR 0001 section 5), so this only needs to be a stable, deterministic
// approximation for DocumentChunk.tokenCount — not an exact tokenizer count.
const approxCharsPerToken = 4;

/**
 * text -> ordered chunks, splitting on paragraph boundaries and falling back to a
 * hard character cut for any paragraph longer than the max chunk size.
 */
export function chunkText(text: string): TextChunk[] {
	const normalized = text.replace(/\r\n/g, '\n').trim();
	if (!normalized) return [];

	const paragraphs = normalized
		.split(/\n{2,}/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean);

	const pieces: string[] = [];
	let current = '';

	for (const paragraph of paragraphs) {
		const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
		if (candidate.length > maxChunkChars && current) {
			pieces.push(current);
			current = paragraph;
		} else {
			current = candidate;
		}
		while (current.length > maxChunkChars) {
			pieces.push(current.slice(0, maxChunkChars));
			current = current.slice(maxChunkChars);
		}
	}
	if (current) pieces.push(current);

	return pieces.map((pieceText, ordinal) => ({
		ordinal,
		text: pieceText,
		tokenCount: Math.max(1, Math.ceil(pieceText.length / approxCharsPerToken))
	}));
}
