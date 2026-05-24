import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { getGroqClient, SYSTEM_PROMPT, AGENT_TOOLS, GROQ_MODELS, DEFAULT_MODEL } from '@/lib/groq'
import {
  buildPageChunks, retrieveRelevantChunks, buildKBContext,
  extractTextFromBlocks, getAntiHallucinationRules, STRUCTURED_RESPONSE_FORMAT,
  type KBChunk,
} from '@/lib/rag'
import type { GroqModelId } from '@/lib/groq'
import type Groq from 'groq-sdk'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const {
      messages, workspaceId, currentPageId,
      model: requestedModel, userApiKey,
      attachedFiles, kbItems,
    } = await req.json() as {
      messages: { role: string; content: string }[]
      workspaceId: string
      currentPageId?: string
      model?: string
      userApiKey?: string
      attachedFiles?: Array<{ name: string; type: string; content: string }>
      kbItems?: Array<{ id: string; name: string; extracted_text: string; file_type: string }>
    }

    if (!messages || !workspaceId)
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const validModelIds = GROQ_MODELS.map((m) => m.id)
    const model: GroqModelId = validModelIds.includes(requestedModel as GroqModelId)
      ? (requestedModel as GroqModelId) : DEFAULT_MODEL

    // ── 1. Fetch pages ───────────────────────────────────────────────────────
    const { data: pages } = await supabaseAdmin
      .from('pages')
      .select('id, title, icon, content, updated_at')
      .eq('workspace_id', workspaceId)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })
      .limit(50)

    // ── 2. Fetch KB items ────────────────────────────────────────────────────
    let dbKBItems: Array<{ id: string; name: string; extracted_text: string; file_type: string }> = []
    try {
      const { data } = await supabaseAdmin
        .from('knowledge_base')
        .select('id, name, extracted_text, file_type')
        .eq('workspace_id', workspaceId)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(30)
      dbKBItems = data || []
    } catch { /* table may not exist */ }

    const allKBItems = [...dbKBItems, ...(kbItems || [])]

    // ── 3. Build RAG chunks ──────────────────────────────────────────────────
    const pageChunks: KBChunk[] = buildPageChunks(pages || [])
    const kbChunks: KBChunk[] = allKBItems.flatMap((item) =>
      item.extracted_text ? [{
        id: `kb-${item.id}`, source: item.name, sourceType: 'kb_file' as const,
        content: item.extracted_text.slice(0, 3000), metadata: { fileId: item.id },
      }] : []
    )
    const attachedChunks: KBChunk[] = (attachedFiles || [])
      .filter((f) => !f.type.startsWith('image/'))
      .map((f, i) => ({
        id: `attached-${i}`, source: f.name, sourceType: 'kb_file' as const,
        content: f.content.slice(0, 3000), metadata: {},
      }))
    const allChunks = [...pageChunks, ...kbChunks, ...attachedChunks]

    // ── 4. RAG retrieval ─────────────────────────────────────────────────────
    const userQuery = messages[messages.length - 1]?.content || ''
    const relevantChunks = retrieveRelevantChunks(userQuery, allChunks, 6, 0.05)

    // ── 5. Current page content ──────────────────────────────────────────────
    let currentPageContent: string | undefined
    let currentPageTitle: string | undefined
    if (currentPageId && pages) {
      const cp = pages.find((p) => p.id === currentPageId)
      if (cp) { currentPageContent = extractTextFromBlocks(cp.content); currentPageTitle = cp.title }
    }

    // ── 6. Build context & prompt ────────────────────────────────────────────
    const hasKBData = relevantChunks.length > 0 || allKBItems.length > 0 || (attachedFiles?.length ?? 0) > 0
    const kbContext = buildKBContext(relevantChunks, currentPageContent, currentPageTitle)
    const pageListContext = pages?.length
      ? pages.map((p) => `- ${p.icon || '📄'} "${p.title}" (id: ${p.id})`).join('\n')
      : 'No pages yet'

    const currentPageInfo = currentPageId && currentPageTitle
      ? `ACTIVE PAGE (user is currently on this page — insert content HERE by default):
- Page ID: ${currentPageId}
- Page Title: "${currentPageTitle}"
→ RULE: If user asks to add/insert/create todo/checklist/content — call update_page_content with page_id="${currentPageId}". Do NOT create_page.`
      : 'No page currently open. If user wants to save content, create a new page.'

    const systemContent = `${SYSTEM_PROMPT}

WORKSPACE CONTEXT:
- Workspace ID: ${workspaceId}
- User ID: ${session.user.id}
- Total pages: ${pages?.length || 0}
- KB files loaded: ${allKBItems.length + (attachedFiles?.length ?? 0)}

${currentPageInfo}

PAGES IN WORKSPACE:
${pageListContext}

${kbContext ? `---\n${kbContext}\n---` : ''}

${getAntiHallucinationRules(relevantChunks.length > 0)}

${STRUCTURED_RESPONSE_FORMAT}

CRITICAL RULES:
1. When a page is active, ALWAYS use update_page_content for insertions — NEVER create_page.
2. For todo/task/checklist requests: use "- [ ] item" markdown. For headings: # ## ###.
3. The "content" arg must be clean markdown ONLY (max 2000 chars). No explanations inside it.
4. NEVER wrap content in triple backticks inside tool arguments.`

    // ── 7. Agentic loop ──────────────────────────────────────────────────────
    const imageFiles = (attachedFiles || []).filter((f) => f.type.startsWith('image/'))

    // Build the final user message — multimodal if images are attached
    type ContentBlock =
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }

    const finalUserContent: ContentBlock[] = [{ type: 'text', text: userQuery }]
    for (const img of imageFiles) {
      // content is a base64 data URL like "data:image/png;base64,..."
      if (img.content.startsWith('data:')) {
        finalUserContent.push({ type: 'image_url', image_url: { url: img.content } })
      }
    }

    const groqMessages: Groq.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemContent },
      ...messages.slice(0, -1).map((m) => ({
        role: m.role as 'user' | 'assistant', content: m.content,
      })),
      {
        role: 'user' as const,
        content: finalUserContent.length === 1 ? userQuery : (finalUserContent as Groq.Chat.ChatCompletionContentPart[]),
      },
    ]

    let activeModel = model
    // Auto-switch to a vision-capable model if images are present
    if (imageFiles.length > 0) {
      const visionModel = GROQ_MODELS.find((m) => (m as { supportsVision?: boolean }).supportsVision)
      if (visionModel && visionModel.id !== model) activeModel = visionModel.id as GroqModelId
    }
    const modelConfig = GROQ_MODELS.find((m) => m.id === activeModel)
    const supportsTools = modelConfig?.supportsTools !== false
    let lastActionData: { type: string; pageId?: string; title?: string } | null = null
    let loopCount = 0
    const MAX_LOOPS = 6

    while (loopCount < MAX_LOOPS) {
      loopCount++
      const groq = getGroqClient(userApiKey)
      const response = await groq.chat.completions.create({
        model: activeModel, messages: groqMessages,
        ...(supportsTools && imageFiles.length === 0 ? { tools: AGENT_TOOLS, tool_choice: 'auto' as const } : {}),
        max_tokens: 4096, temperature: 0.3,
      })

      const choice = response.choices[0]
      const assistantMessage = choice.message

      // Validate finish reason — if generation failed/truncated, bail early
      if (choice.finish_reason === 'length') {
        return NextResponse.json({
          content: 'The response was too long or an error occurred. Please try a shorter request.',
          action: lastActionData,
          sourcesUsed: [],
        })
      }

      // Validate tool_calls — skip push if any have empty/broken arguments
      const hasValidToolCalls = assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0 &&
        assistantMessage.tool_calls.every((tc) => {
          try { JSON.parse(tc.function.arguments); return true } catch { return false }
        })

      if (!hasValidToolCalls && assistantMessage.tool_calls?.length) {
        // Broken tool call — don't push to history, return error message
        return NextResponse.json({
          content: 'The AI tried to perform an action but the response was too large or malformed. Try asking it to summarize the content instead of inserting it verbatim.',
          action: null,
          sourcesUsed: [],
        })
      }

      // If no structured tool_calls but content has <function=...> fallback format, parse it manually
      if ((!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) && assistantMessage.content) {
        const funcMatch = assistantMessage.content.match(/<function=([\w]+)>([\s\S]*?)(?:<\/function>|$)/)
        if (funcMatch) {
          const fnName = funcMatch[1]
          const rawArgs = funcMatch[2].trim()
          let parsedArgs: Record<string, string> = {}
          try { parsedArgs = JSON.parse(rawArgs) } catch { /* skip */ }
          if (fnName && Object.keys(parsedArgs).length > 0) {
            // Strip code fences from content arg
            if (parsedArgs.content) {
              parsedArgs.content = parsedArgs.content.replace(/^\s*```[\w]*\n?/gm, '').replace(/\n?```\s*$/gm, '').trim()
            }
            // Re-inject as a synthetic tool call
            ;(assistantMessage as unknown as Record<string, unknown>).tool_calls = [{
              id: `synthetic-${Date.now()}`,
              type: 'function',
              function: { name: fnName, arguments: JSON.stringify(parsedArgs) },
            }]
            ;(assistantMessage as unknown as Record<string, unknown>).content = null
          }
        }
      }

      groqMessages.push(assistantMessage)

      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        const rawContent = assistantMessage.content || ''
        const cleaned = rawContent
          .replace(/\?\?\?+/g, '[data unavailable]')
          || (hasKBData
            ? 'Insufficient or unclear data from Knowledge Base for this query.'
            : 'I could not generate a response. Please rephrase your question.')

        return NextResponse.json({
          content: cleaned,
          action: lastActionData,
          sourcesUsed: relevantChunks.map((c) => ({ source: c.source, type: c.sourceType })),
        })
      }

      for (const toolCall of assistantMessage.tool_calls) {
        const fnName = toolCall.function.name
        let args: Record<string, string> = {}
        try { args = JSON.parse(toolCall.function.arguments) } catch { /* empty */ }
        let toolResult = ''

        // Sanitize content arg — strip code fences and hard-cap length
        if (args.content) {
          args.content = args.content
            .replace(/^\s*```[\w]*\n?/gm, '')
            .replace(/\n?```\s*$/gm, '')
            .trim()
            .slice(0, 3000)
        }

        switch (fnName) {
          case 'create_page': {
            const blocks = args.content ? parseMarkdownToBlocks(args.content) : null
            const { data: newPage, error } = await supabaseAdmin
              .from('pages')
              // @ts-ignore
              .insert({ workspace_id: workspaceId, title: args.title || 'Untitled', icon: args.icon || getDefaultIcon(args.title || ''), content: blocks, created_by: session.user.id, parent_id: args.parent_id || null })
              .select().single()
            toolResult = error ? `Error creating page: ${error.message}` : `Created page "${newPage.title}" (id: ${newPage.id})`
            if (!error) lastActionData = { type: 'page_created', pageId: newPage.id, title: newPage.title }
            break
          }
          case 'search_pages': {
            const { data: results } = await supabaseAdmin.from('pages').select('id, title, icon, updated_at').eq('workspace_id', workspaceId).eq('is_archived', false).ilike('title', `%${args.query}%`).limit(8)
            toolResult = (!results || results.length === 0) ? `No pages found matching "${args.query}"` : `Found ${results.length}: ${results.map((p) => `"${p.title}" (${p.id})`).join(', ')}`
            if (results?.length) lastActionData = { type: 'search_results' }
            break
          }
          case 'get_page_content': {
            const baseQ = supabaseAdmin.from('pages').select('id, title, content, icon').eq('workspace_id', workspaceId)
            const { data: pageData } = await (args.page_id ? baseQ.eq('id', args.page_id) : baseQ.ilike('title', `%${args.title || ''}%`)).maybeSingle()
            toolResult = !pageData ? 'Page not found' : `Page: "${pageData.title}"\n\n${extractTextFromBlocks(pageData.content).slice(0, 2000)}`
            break
          }
          case 'update_page_content': {
            // Truncate very large content to prevent Supabase/Groq payload issues
            const safeContent = args.content ? args.content.slice(0, 8000) : ''
            const blocks = safeContent ? parseMarkdownToBlocks(safeContent) : null
            // @ts-ignore
            const { error } = await supabaseAdmin.from('pages').update({ content: blocks, updated_at: new Date().toISOString() }).eq('id', args.page_id).eq('workspace_id', workspaceId)
            toolResult = error ? `Error: ${error.message}` : `Updated page ${args.page_id}`
            if (!error) lastActionData = { type: 'page_updated', pageId: args.page_id }
            break
          }
          case 'update_page_title': {
            // @ts-ignore
            const { error } = await supabaseAdmin.from('pages').update({ title: args.new_title, updated_at: new Date().toISOString() }).eq('id', args.page_id).eq('workspace_id', workspaceId)
            toolResult = error ? `Error: ${error.message}` : `Renamed to "${args.new_title}"`
            if (!error) lastActionData = { type: 'page_updated', pageId: args.page_id }
            break
          }
          case 'list_pages': {
            const allPages = pages || []
            toolResult = allPages.length === 0 ? 'No pages yet.' : `${allPages.length} pages:\n${allPages.map((p) => `- ${p.icon || '📄'} "${p.title}" (${p.id})`).join('\n')}`
            break
          }
          default:
            toolResult = `Unknown tool: ${fnName}`
        }

        groqMessages.push({ role: 'tool', tool_call_id: toolCall.id, content: toolResult })
      }
    }

    return NextResponse.json({ content: 'Actions completed! Let me know if you need anything else.', action: lastActionData })
  } catch (error: unknown) {
    console.error('AI API error:', error)
    const err = error as { message?: string; status?: number }
    const msg = err.message || ''
    if (msg.includes('Rate limit') || msg.includes('rate_limit') || err.status === 429) {
      return NextResponse.json({ error: 'Rate limit reached — please wait a moment.' }, { status: 429 })
    }
    return NextResponse.json({ error: msg || 'AI request failed' }, { status: 500 })
  }
}

function parseMarkdownToBlocks(markdown: string) {
  // Strip wrapping code fences if the whole thing is wrapped
  const stripped = markdown.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim()
  const lines = stripped.split('\n')
  const blocks: unknown[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) { i++; continue }

    let type = 'paragraph'
    let text = line
    let level = 1
    let checked = false
    const extraProps: Record<string, unknown> = {}

    if (line.startsWith('### ')) { type = 'heading'; level = 3; text = line.slice(4) }
    else if (line.startsWith('## ')) { type = 'heading'; level = 2; text = line.slice(3) }
    else if (line.startsWith('# ')) { type = 'heading'; level = 1; text = line.slice(2) }
    else if (/^- \[x\] /i.test(line)) { type = 'checkListItem'; checked = true; text = line.slice(6) }
    else if (line.startsWith('- [ ] ')) { type = 'checkListItem'; checked = false; text = line.slice(6) }
    else if (line.startsWith('- ') || line.startsWith('* ')) { type = 'bulletListItem'; text = line.slice(2) }
    else if (/^\d+\. /.test(line)) { type = 'numberedListItem'; text = line.replace(/^\d+\. /, '') }
    else if (line.startsWith('> ')) { type = 'quote'; text = line.slice(2) }
    else if (line.startsWith('```')) {
      // Collect code block lines
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      blocks.push({
        id: `ai-block-${blocks.length}`,
        type: 'codeBlock',
        props: { language: lang || 'text', textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
        content: [{ type: 'text', text: codeLines.join('\n'), styles: {} }],
        children: [],
      })
      i++
      continue
    }

    if (type === 'heading') extraProps.level = level
    if (type === 'checkListItem') extraProps.checked = checked

    blocks.push({
      id: `ai-block-${blocks.length}`,
      type,
      props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left', ...extraProps },
      content: [{ type: 'text', text: text.trim(), styles: {} }],
      children: [],
    })
    i++
  }

  return blocks.length > 0 ? blocks : [{ id: 'ai-block-0', type: 'paragraph', props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' }, content: [{ type: 'text', text: stripped, styles: {} }], children: [] }]
}

function getDefaultIcon(title: string): string {
  const t = (title || '').toLowerCase()
  if (t.includes('meet') || t.includes('standup')) return '🤝'
  if (t.includes('todo') || t.includes('task')) return '✅'
  if (t.includes('idea')) return '💡'
  if (t.includes('plan') || t.includes('road')) return '🗺️'
  if (t.includes('note')) return '📝'
  if (t.includes('project')) return '🚀'
  if (t.includes('design')) return '🎨'
  if (t.includes('code') || t.includes('dev')) return '💻'
  if (t.includes('research')) return '🔬'
  if (t.includes('finance') || t.includes('budget')) return '💰'
  return '📄'
}
