import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { getGroqClient, SYSTEM_PROMPT, AGENT_TOOLS, GROQ_MODELS, DEFAULT_MODEL } from '@/lib/groq'
import type { GroqModelId } from '@/lib/groq'
import type Groq from 'groq-sdk'

// Service-role client — bypasses RLS so the AI can create/update/read freely
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // Verify the user is authenticated
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { messages, workspaceId, currentPageId, model: requestedModel } = await req.json()
    if (!messages || !workspaceId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate the model — fall back to default if unknown
    const validModelIds = GROQ_MODELS.map((m) => m.id)
    const model: GroqModelId = validModelIds.includes(requestedModel) ? requestedModel : DEFAULT_MODEL

    // Get workspace pages for context (use admin to avoid RLS issues)
    const { data: pages } = await supabaseAdmin
      .from('pages')
      .select('id, title, icon, updated_at')
      .eq('workspace_id', workspaceId)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })
      .limit(30)

    const pageContext = pages?.length
      ? pages.map((p) => `- ${p.icon || '📄'} "${p.title}" (id: ${p.id})`).join('\n')
      : 'No pages yet'

    // Build Groq message history
    const groqMessages: Groq.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `${SYSTEM_PROMPT}

WORKSPACE CONTEXT:
- Workspace ID: ${workspaceId}
- User ID: ${session.user.id}
- Total pages: ${pages?.length || 0}
- Currently viewing page: ${currentPageId || 'none'}
- Pages in workspace:
${pageContext}

IMPORTANT: When the user asks you to create, update, search, or list pages — ALWAYS use the available tools. Do not just describe what you would do — actually call the tool.`,
      },
      ...messages.slice(0, -1).map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      {
        role: 'user' as const,
        content: messages[messages.length - 1].content,
      },
    ]

    // Agentic loop — keeps running until no more tool calls
    const actionData: { type: string; pageId?: string; title?: string } | null = null
    let lastActionData: { type: string; pageId?: any; title?: any } | null = actionData
    let loopCount = 0
    const MAX_LOOPS = 6

    while (loopCount < MAX_LOOPS) {
      loopCount++

      const groq = getGroqClient()
      const response = await groq.chat.completions.create({
        model,
        messages: groqMessages,
        tools: AGENT_TOOLS,
        tool_choice: loopCount === 1 ? 'auto' : 'auto',
        max_tokens: 2048,
        temperature: 0.3, // Lower temp = more deterministic tool use
      })

      const choice = response.choices[0]
      const assistantMessage = choice.message

      groqMessages.push(assistantMessage)

      // No more tool calls — return final answer
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        return NextResponse.json({
          content: assistantMessage.content || 'Done! Let me know if you need anything else.',
          action: lastActionData,
        })
      }

      // Execute each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        const fnName = toolCall.function.name
        let args: Record<string, string> = {}
        try { args = JSON.parse(toolCall.function.arguments) } catch { /* empty args */ }

        let toolResult = ''

        switch (fnName) {
          // ── Create page ────────────────────────────────────────────────────
          case 'create_page': {
            const blocks = args.content ? parseMarkdownToBlocks(args.content) : null
            const { data: newPage, error } = await supabaseAdmin
              .from('pages')
              .insert({
                workspace_id: workspaceId,
                title: args.title || 'Untitled',
                icon: args.icon || getDefaultIcon(args.title || ''),
                content: blocks,
                created_by: session.user.id,
                parent_id: args.parent_id || null,
              })
              .select()
              .single()

            if (error) {
              toolResult = `Error creating page: ${error.message}`
            } else {
              toolResult = `Successfully created page "${newPage.title}" with ID: ${newPage.id}`
              lastActionData = { type: 'page_created', pageId: newPage.id, title: newPage.title }
            }
            break
          }

          // ── Search pages ───────────────────────────────────────────────────
          case 'search_pages': {
            const { data: results } = await supabaseAdmin
              .from('pages')
              .select('id, title, icon, updated_at')
              .eq('workspace_id', workspaceId)
              .eq('is_archived', false)
              .ilike('title', `%${args.query}%`)
              .limit(8)

            if (!results || results.length === 0) {
              toolResult = `No pages found matching "${args.query}"`
            } else {
              toolResult = `Found ${results.length} page(s):\n${results.map((p) => `- ${p.icon || '📄'} "${p.title}" (id: ${p.id})`).join('\n')}`
              lastActionData = { type: 'search_results' }
            }
            break
          }

          // ── Get page content ───────────────────────────────────────────────
          case 'get_page_content': {
            const baseQ = supabaseAdmin
              .from('pages')
              .select('id, title, content, icon')
              .eq('workspace_id', workspaceId)

            const finalQ = args.page_id
              ? baseQ.eq('id', args.page_id)
              : baseQ.ilike('title', `%${args.title || ''}%`)

            const { data: pageData } = await finalQ.maybeSingle()
            if (!pageData) {
              toolResult = 'Page not found'
            } else {
              const text = extractTextFromBlocks(pageData.content)
              toolResult = `Page: "${pageData.title}"\n\nContent:\n${text.slice(0, 2000)}`
            }
            break
          }

          // ── Update page content ────────────────────────────────────────────
          case 'update_page_content': {
            const blocks = args.content ? parseMarkdownToBlocks(args.content) : null
            const { error } = await supabaseAdmin
              .from('pages')
              .update({ content: blocks, updated_at: new Date().toISOString() })
              .eq('id', args.page_id)
              .eq('workspace_id', workspaceId)

            toolResult = error
              ? `Error updating page: ${error.message}`
              : `Updated content of page ${args.page_id}`
            lastActionData = { type: 'page_updated', pageId: args.page_id }
            break
          }

          // ── Update page title ──────────────────────────────────────────────
          case 'update_page_title': {
            const { error } = await supabaseAdmin
              .from('pages')
              .update({ title: args.new_title, updated_at: new Date().toISOString() })
              .eq('id', args.page_id)
              .eq('workspace_id', workspaceId)

            toolResult = error
              ? `Error renaming page: ${error.message}`
              : `Renamed page to "${args.new_title}"`
            lastActionData = { type: 'page_updated', pageId: args.page_id }
            break
          }

          // ── List pages ─────────────────────────────────────────────────────
          case 'list_pages': {
            const allPages = pages || []
            toolResult = allPages.length === 0
              ? 'No pages in workspace yet.'
              : `${allPages.length} page(s):\n${allPages.map((p) => `- ${p.icon || '📄'} "${p.title}" (id: ${p.id})`).join('\n')}`
            break
          }

          default:
            toolResult = `Unknown tool: ${fnName}`
        }

        groqMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult,
        })
      }
    }

    return NextResponse.json({
      content: 'Actions completed! Let me know if you need anything else.',
      action: lastActionData,
    })
  } catch (error: unknown) {
    console.error('AI API error:', error)
    const err = error as { message?: string; status?: number; error?: { type?: string } }
    // Groq rate limit
    const msg = err.message || ''
    if (msg.includes('Rate limit') || msg.includes('rate_limit') || (err as { status?: number }).status === 429) {
      return NextResponse.json(
        { error: 'Rate limit reached — please wait a moment and try again.' },
        { status: 429 }
      )
    }
    return NextResponse.json({ error: msg || 'AI request failed' }, { status: 500 })
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseMarkdownToBlocks(markdown: string) {
  const lines = markdown.split('\n').filter((l) => l.trim())
  return lines.map((line, i) => {
    let type = 'paragraph'
    let text = line
    let level = 1

    if (line.startsWith('### ')) { type = 'heading'; level = 3; text = line.slice(4) }
    else if (line.startsWith('## ')) { type = 'heading'; level = 2; text = line.slice(3) }
    else if (line.startsWith('# ')) { type = 'heading'; level = 1; text = line.slice(2) }
    else if (line.startsWith('- [ ] ')) { type = 'checkListItem'; text = line.slice(6) }
    else if (line.startsWith('- ') || line.startsWith('* ')) { type = 'bulletListItem'; text = line.slice(2) }
    else if (line.match(/^\d+\. /)) { type = 'numberedListItem'; text = line.replace(/^\d+\. /, '') }
    else if (line.startsWith('> ')) { type = 'quote'; text = line.slice(2) }

    return {
      id: `ai-block-${i}`,
      type,
      props: {
        textColor: 'default',
        backgroundColor: 'default',
        textAlignment: 'left',
        ...(type === 'heading' ? { level } : {}),
      },
      content: [{ type: 'text', text: text.trim(), styles: {} }],
      children: [],
    }
  })
}

function extractTextFromBlocks(content: unknown): string {
  if (!content || !Array.isArray(content)) return ''
  try {
    const texts: string[] = []
    const extract = (blocks: Array<{ content?: Array<{ text?: string }>; children?: unknown[] }>) => {
      for (const block of blocks) {
        if (block.content) for (const inline of block.content) if (inline.text) texts.push(inline.text)
        if (block.children && Array.isArray(block.children)) extract(block.children as typeof blocks)
      }
    }
    extract(content as Parameters<typeof extract>[0])
    return texts.join(' ')
  } catch { return '' }
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
  if (t.includes('journal') || t.includes('diary')) return '📔'
  return '📄'
}
