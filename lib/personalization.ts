import type { UserMemory, UploadedContext } from '@/types'

export const DEFAULT_MEMORY: Omit<UserMemory, 'id' | 'userId' | 'workspaceId'> = {
  weakAreas: [],
  strongAreas: [],
  interactionCount: 0,
  preferredDepth: 'intermediate',
  preferredTone: 'concise',
  preferredStyle: 'bullet',
  uploadedContexts: [],
  progressLog: [],
  lastUpdated: new Date().toISOString(),
}

export function buildMemoryContext(memory: UserMemory): string {
  const parts: string[] = []

  if (memory.preferredDepth) parts.push(`Depth preference: ${memory.preferredDepth}`)
  if (memory.preferredTone)  parts.push(`Tone preference: ${memory.preferredTone}`)
  if (memory.preferredStyle) parts.push(`Style preference: ${memory.preferredStyle}`)

  if (memory.weakAreas.length > 0)
    parts.push(`User struggles with: ${memory.weakAreas.join(', ')}`)
  if (memory.strongAreas.length > 0)
    parts.push(`User is strong at: ${memory.strongAreas.join(', ')}`)

  if (memory.uploadedContexts.length > 0) {
    parts.push(`\nUser-provided context (${memory.uploadedContexts.length} document(s)):`)
    memory.uploadedContexts.forEach((ctx) => {
      parts.push(`--- [${ctx.type.toUpperCase()}] ${ctx.name} ---\n${ctx.content.slice(0, 500)}`)
    })
  }

  if (memory.interactionCount > 0)
    parts.push(`Total past interactions: ${memory.interactionCount}`)

  return parts.join('\n')
}

export function detectWeakAreas(messages: { role: string; content: string }[]): string[] {
  // Simple heuristic: look for repeated questions or confusion signals
  const confusion = ['don\'t understand', 'confused', 'not clear', 'explain again', 'still don\'t', 'what does', 'what is']
  const topics = new Map<string, number>()

  messages.forEach((m) => {
    if (m.role !== 'user') return
    const lower = m.content.toLowerCase()
    if (confusion.some((c) => lower.includes(c))) {
      // extract rough topic (first noun-ish word after confusion phrase)
      const match = lower.match(/(?:about|regarding|with|on)\s+([a-z\s]{3,20})/)
      if (match) {
        const topic = match[1].trim()
        topics.set(topic, (topics.get(topic) || 0) + 1)
      }
    }
  })

  return Array.from(topics.entries())
    .filter(([, count]) => count >= 2)
    .map(([topic]) => topic)
}

export function extractContextFromText(text: string, maxChars = 1500): string {
  // Strip excessive whitespace and truncate
  return text.replace(/\s+/g, ' ').trim().slice(0, maxChars)
}

export function generateContextId(): string {
  return `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
