/**
 * RAG (Retrieval-Augmented Generation) Engine for Noted AI
 * Handles KB chunking, similarity search, and context injection
 */

export interface KBChunk {
  id: string
  source: string      // page title or file name
  sourceType: 'page' | 'kb_file' | 'note'
  content: string
  metadata: {
    pageId?: string
    fileId?: string
    updatedAt?: string
    icon?: string
  }
}

/** Split text into overlapping chunks for better retrieval */
export function chunkText(text: string, chunkSize = 400, overlap = 80): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  let i = 0
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(' ')
    if (chunk.trim()) chunks.push(chunk.trim())
    i += chunkSize - overlap
  }
  return chunks
}

/** Simple TF-IDF-style keyword scoring for relevance (no embeddings needed) */
export function scoreRelevance(query: string, text: string): number {
  const qTerms = tokenize(query)
  const docTerms = tokenize(text)
  const docFreq = new Map<string, number>()
  for (const t of docTerms) docFreq.set(t, (docFreq.get(t) || 0) + 1)

  let score = 0
  for (const term of qTerms) {
    const tf = (docFreq.get(term) || 0) / Math.max(docTerms.length, 1)
    // Boost exact matches more
    if (docFreq.has(term)) score += tf * 10 + 1
    // Partial match
    else {
      for (const dt of docFreq.keys()) {
        if (dt.includes(term) || term.includes(dt)) {
          score += 0.3
          break
        }
      }
    }
  }
  return score
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2)
}

/** Retrieve top-k relevant chunks from the KB */
export function retrieveRelevantChunks(
  query: string,
  chunks: KBChunk[],
  topK = 5,
  minScore = 0.1
): Array<KBChunk & { score: number }> {
  const scored = chunks.map((chunk) => ({
    ...chunk,
    score: scoreRelevance(query, chunk.content),
  }))

  return scored
    .filter((c) => c.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

/** Build the full context string to inject into prompt */
export function buildKBContext(
  relevantChunks: Array<KBChunk & { score: number }>,
  currentPageContent?: string,
  currentPageTitle?: string
): string {
  const parts: string[] = []

  if (currentPageContent) {
    parts.push(`## Currently Viewing Page: "${currentPageTitle || 'Untitled'}"\n${currentPageContent.slice(0, 800)}`)
  }

  if (relevantChunks.length > 0) {
    parts.push('## Knowledge Base — Relevant Context')
    for (const chunk of relevantChunks) {
      const icon = chunk.metadata.icon || (chunk.sourceType === 'page' ? '📄' : '📎')
      parts.push(`### ${icon} ${chunk.source} [${chunk.sourceType}]\n${chunk.content}`)
    }
  }

  return parts.join('\n\n')
}

/** Extract text from BlockNote editor JSON blocks */
export function extractTextFromBlocks(content: unknown): string {
  if (!content || !Array.isArray(content)) return ''
  try {
    const texts: string[] = []
    const extract = (blocks: Array<{ content?: Array<{ text?: string }>; children?: unknown[]; type?: string }>) => {
      for (const block of blocks) {
        if (block.content) {
          for (const inline of block.content) {
            if (inline.text) texts.push(inline.text)
          }
        }
        if (block.children && Array.isArray(block.children)) {
          extract(block.children as typeof blocks)
        }
      }
    }
    extract(content as Parameters<typeof extract>[0])
    return texts.join(' ').trim()
  } catch {
    return ''
  }
}

/** Build chunks from all pages in a workspace */
export function buildPageChunks(
  pages: Array<{ id: string; title: string; content: unknown; icon?: string | null; updated_at: string }>
): KBChunk[] {
  const chunks: KBChunk[] = []
  for (const page of pages) {
    const text = extractTextFromBlocks(page.content)
    if (!text && !page.title) continue
    const fullText = `${page.title}\n${text}`.trim()
    const parts = chunkText(fullText)
    parts.forEach((part, i) => {
      chunks.push({
        id: `page-${page.id}-${i}`,
        source: page.title || 'Untitled',
        sourceType: 'page',
        content: part,
        metadata: {
          pageId: page.id,
          updatedAt: page.updated_at,
          icon: page.icon || undefined,
        },
      })
    })
  }
  return chunks
}

/** Format the anti-hallucination system instruction */
export function getAntiHallucinationRules(hasKBData: boolean): string {
  if (!hasKBData) {
    return `
KNOWLEDGE BASE STATUS: No relevant KB data found for this query.
→ Answer from general knowledge only.
→ Clearly state: "Based on general knowledge (no KB data available for this topic)".
→ NEVER fabricate specific facts about the user's workspace.`
  }
  return `
KNOWLEDGE BASE STATUS: Relevant context has been injected above.
→ Prioritize KB data over general knowledge for workspace-specific questions.
→ If KB data partially answers the question, give a partial answer and say what's missing.
→ NEVER guess values, names, or facts not present in the provided context.
→ If data is ambiguous, say: "The KB contains unclear data on this — here's what I found: ..."
→ DO NOT output "???" or broken/empty responses.`
}

/** Structured response format instructions */
export const STRUCTURED_RESPONSE_FORMAT = `
RESPONSE FORMAT (always follow this):
1. **Direct Answer** — answer the question directly and concisely
2. **Source** — state where the answer comes from: [Knowledge Base | Page Content | General Knowledge]
3. **Explanation** — brief supporting context or reasoning
4. (Optional) **Example** — only if it meaningfully clarifies the answer

For complex multi-step queries: break into steps, solve each, then combine.
Keep answers clean. Never output broken text or placeholder symbols.`
