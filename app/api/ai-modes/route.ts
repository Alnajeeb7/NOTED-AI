import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { getGroqClient, AGENT_TOOLS, GROQ_MODELS, DEFAULT_MODEL } from '@/lib/groq'
import { getModeSystemPrompt, AGENTIC_EXTRA_TOOLS, buildPlanMarkdown } from '@/lib/ai-modes'
import { buildMemoryContext } from '@/lib/personalization'
import type { GroqModelId } from '@/lib/groq'
import type { AIMode, UserMemory } from '@/types'
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
      model: requestedModel, mode = 'chat', memory,
    } = await req.json() as {
      messages: { role: string; content: string }[]
      workspaceId: string
      currentPageId?: string
      model?: string
      mode?: AIMode
      memory?: UserMemory
    }

    if (!messages || !workspaceId)
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const validModelIds = GROQ_MODELS.map((m) => m.id)
    const model: GroqModelId = validModelIds.includes(requestedModel as GroqModelId)
      ? (requestedModel as GroqModelId)
      : DEFAULT_MODEL

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

    const memoryContext = memory ? buildMemoryContext(memory) : ''
    const systemPrompt = getModeSystemPrompt(mode, memoryContext, pageContext)

    const modelConfig = GROQ_MODELS.find((m) => m.id === model)
    const supportsTools = modelConfig?.supportsTools !== false

    // Build tool set based on mode
    const tools = mode === 'agentic'
      ? [...AGENT_TOOLS, ...AGENTIC_EXTRA_TOOLS]
      : AGENT_TOOLS

    const groqMessages: Groq.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `${systemPrompt}\n\nWorkspace ID: ${workspaceId}\nUser ID: ${session.user.id}\nCurrently viewing: ${currentPageId || 'none'}\nTotal pages: ${pages?.length || 0}`,
      },
      ...messages.slice(0, -1).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: messages[messages.length - 1].content },
    ]

    let lastActionData: Record<string, unknown> | null = null
    let loopCount = 0
    const MAX_LOOPS = mode === 'agentic' ? 10 : 6

    while (loopCount < MAX_LOOPS) {
      loopCount++
      const groq = getGroqClient()
      const response = await groq.chat.completions.create({
        model,
        messages: groqMessages,
        ...(supportsTools ? { tools, tool_choice: 'auto' as const } : {}),
        max_tokens: mode === 'agentic' ? 3000 : 2048,
        temperature: mode === 'explore' ? 0.7 : 0.3,
      })

      const choice = response.choices[0]
      const assistantMessage = choice.message
      groqMessages.push(assistantMessage)

      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        return NextResponse.json({
          content: assistantMessage.content || 'Done!',
          action: lastActionData,
          mode,
        })
      }

      for (const toolCall of assistantMessage.tool_calls) {
        const fnName = toolCall.function.name
        let args: Record<string, unknown> = {}
        try { args = JSON.parse(toolCall.function.arguments) } catch { /* empty */ }

        let toolResult = ''

        switch (fnName) {
          case 'create_page': {
            const blocks = args.content ? parseMarkdownToBlocks(args.content as string) : null
            const { data: newPage, error } = await supabaseAdmin
              .from('pages')
              // @ts-ignore
              .insert({
                workspace_id: workspaceId,
                title: args.title || 'Untitled',
                icon: args.icon || getDefaultIcon(args.title as string || ''),
                content: blocks,
                created_by: session.user.id,
                parent_id: args.parent_id || null,
              })
              .select()
              .single()
            toolResult = error
              ? `Error creating page: ${error.message}`
              : `Created page "${newPage.title}" (id: ${newPage.id})`
            if (!error) lastActionData = { type: 'page_created', pageId: newPage.id, title: newPage.title }
            break
          }

          case 'search_pages': {
            const { data: results } = await supabaseAdmin
              .from('pages').select('id, title, icon, updated_at')
              .eq('workspace_id', workspaceId).eq('is_archived', false)
              .ilike('title', `%${args.query}%`).limit(8)
            toolResult = !results?.length
              ? `No pages found matching "${args.query}"`
              : `Found ${results.length} page(s):\n${results.map((p) => `- ${p.icon || '📄'} "${p.title}" (id: ${p.id})`).join('\n')}`
            lastActionData = { type: 'search_results' }
            break
          }

          case 'get_page_content': {
            const q = supabaseAdmin.from('pages').select('id, title, content, icon').eq('workspace_id', workspaceId)
            const { data: pageData } = await (args.page_id
              ? q.eq('id', args.page_id)
              : q.ilike('title', `%${args.title || ''}%`)).maybeSingle()
            toolResult = pageData
              ? `Page: "${pageData.title}"\n\n${extractTextFromBlocks(pageData.content).slice(0, 2000)}`
              : 'Page not found'
            break
          }

          case 'update_page_content': {
            const blocks = args.content ? parseMarkdownToBlocks(args.content as string) : null
            const { error } = await supabaseAdmin.from('pages')
              // @ts-ignore
              .update({ content: blocks, updated_at: new Date().toISOString() })
              .eq('id', args.page_id).eq('workspace_id', workspaceId)
            toolResult = error ? `Error: ${error.message}` : `Updated page ${args.page_id}`
            lastActionData = { type: 'page_updated', pageId: args.page_id }
            break
          }

          case 'update_page_title': {
            const { error } = await supabaseAdmin.from('pages')
              // @ts-ignore
              .update({ title: args.new_title, updated_at: new Date().toISOString() })
              .eq('id', args.page_id).eq('workspace_id', workspaceId)
            toolResult = error ? `Error: ${error.message}` : `Renamed to "${args.new_title}"`
            lastActionData = { type: 'page_updated', pageId: args.page_id }
            break
          }

          case 'list_pages': {
            const allPages = pages || []
            toolResult = allPages.length === 0
              ? 'No pages yet.'
              : `${allPages.length} pages:\n${allPages.map((p) => `- ${p.icon || '📄'} "${p.title}" (id: ${p.id})`).join('\n')}`
            break
          }

          case 'generate_problems': {
            // AI will handle generation in next loop — just pass context back
            toolResult = `Generate ${args.count || 5} ${args.difficulty || 'mixed'} difficulty problems for topic: "${args.topic}". Include solutions: ${args.include_solutions || false}. Format as numbered markdown list.`
            break
          }

          case 'create_learning_plan': {
            const topics = args.topics as string[] || []
            const goal = args.goal as string || 'mastery'
            const days = args.days as number || 14
            const hoursPerDay = args.hours_per_day as number || 2
            const planMarkdown = buildPlanMarkdown(topics, goal, days, hoursPerDay)

            if (args.save_as_page) {
              const blocks = parseMarkdownToBlocks(planMarkdown)
              const { data: planPage, error } = await supabaseAdmin
                .from('pages')
                // @ts-ignore
                .insert({
                  workspace_id: workspaceId,
                  title: `🗺️ Learning Plan — ${topics[0] || goal}`,
                  icon: '🗺️',
                  content: blocks,
                  created_by: session.user.id,
                  parent_id: null,
                })
                .select()
                .single()
              toolResult = error
                ? `Plan generated but couldn't save: ${error.message}`
                : `Learning plan created and saved as page "${planPage.title}" (id: ${planPage.id})`
              if (!error) lastActionData = { type: 'page_created', pageId: planPage.id, title: planPage.title }
            } else {
              toolResult = `Here is the learning plan:\n\n${planMarkdown}`
              lastActionData = { type: 'plan_generated' }
            }
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

    return NextResponse.json({ content: 'Actions completed!', action: lastActionData, mode })
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number }
    const msg = err.message || ''
    if (msg.includes('Rate limit') || err.status === 429)
      return NextResponse.json({ error: 'Rate limit reached — please wait.' }, { status: 429 })
    return NextResponse.json({ error: msg || 'AI request failed' }, { status: 500 })
  }
}

function parseMarkdownToBlocks(markdown: string) {
  return markdown.split('\n').filter((l) => l.trim()).map((line, i) => {
    let type = 'paragraph', text = line, level = 1
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
      props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left', ...(type === 'heading' ? { level } : {}) },
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
  if (t.includes('plan') || t.includes('road')) return '🗺️'
  if (t.includes('todo') || t.includes('task')) return '✅'
  if (t.includes('idea')) return '💡'
  if (t.includes('note')) return '📝'
  if (t.includes('project')) return '🚀'
  if (t.includes('code') || t.includes('dev')) return '💻'
  if (t.includes('research')) return '🔬'
  return '📄'
}
