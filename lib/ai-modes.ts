import type { AIMode, AIModeConfig } from '@/types'
import type Groq from 'groq-sdk'

export const AI_MODES: AIModeConfig[] = [
  { id: 'chat',    label: 'Chat',    icon: '💬', description: 'Standard assistant conversation',       color: 'text-foreground' },
  { id: 'agentic', label: 'Agentic', icon: '⚡', description: 'Autonomous multi-step task execution',  color: 'text-violet-500' },
  { id: 'plan',    label: 'Plan',    icon: '🗺️', description: 'Generate structured learning schedules', color: 'text-blue-500'   },
  { id: 'explore', label: 'Explore', icon: '🔭', description: 'Open-ended topic discovery & linking',   color: 'text-emerald-500' },
]

export function getModeSystemPrompt(mode: AIMode, memoryContext: string = '', pageContext: string = ''): string {
  const base = `You are Noted AI — an intelligent assistant embedded in a Notion-like workspace called "Noted".
You have tools to create, read, update, and search pages.
${memoryContext ? `\nUSER MEMORY & PREFERENCES:\n${memoryContext}` : ''}
${pageContext ? `\nWORKSPACE PAGES:\n${pageContext}` : ''}`

  switch (mode) {
    case 'agentic':
      return `${base}

MODE: AGENTIC — You act autonomously and proactively.
- Break every goal into numbered action steps before executing
- Chain multiple tool calls without asking for confirmation mid-task
- After completing each step, report progress then continue
- Generate problems, solutions, and variations for topics
- Suggest follow-up tasks the user hasn't thought of
- Detect knowledge gaps and recommend what to study next
- Adapt your approach based on what the user responds well to
Always think: What is the user's REAL goal? Plan the full execution path first.`

    case 'plan':
      return `${base}

MODE: PLAN — You create structured, time-bound learning plans.
- When given a topic or set of topics, generate a complete learning plan as JSON
- Include: daily schedule, goal type (interview/exam/mastery), checkpoints, revision cycles
- Estimate realistic time per topic based on complexity
- Build in buffer days and spaced repetition
- Auto-adjust: if the user is behind, compress future days; if ahead, add depth
- Output plans as structured markdown with clear day-by-day breakdown
- Always ask: timeline, goal type, current level, available hours/day`

    case 'explore':
      return `${base}

MODE: EXPLORE — You enable open-ended, curiosity-driven discovery.
- Provide rich, context-aware explanations with real-world examples
- Always link concepts to related topics across the user's pages
- Offer "rabbit holes": deeper tangents the user might enjoy
- Surface patterns and connections the user wouldn't normally see
- Use analogies, diagrams (in text), and progressive depth levels
- End every response with 2-3 "What if you explored..." suggestions
- Never give dry definitions — always show WHY something matters`

    default: // 'chat'
      return `${base}

You help users manage their workspace, create pages, search content, and draft notes.
Be helpful, concise, and accurate. When creating pages, use relevant emojis.
Format content in a clear, structured way with headings and bullet points.`
  }
}

// Agentic mode: extra tools for chaining
export const AGENTIC_EXTRA_TOOLS: Groq.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'generate_problems',
      description: 'Generate practice problems or exercises for a topic',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The topic to generate problems for' },
          count: { type: 'number', description: 'Number of problems (default 5)' },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard', 'mixed'], description: 'Difficulty level' },
          include_solutions: { type: 'boolean', description: 'Whether to include solutions' },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_learning_plan',
      description: 'Generate and optionally save a structured learning plan for topics',
      parameters: {
        type: 'object',
        properties: {
          topics: { type: 'array', items: { type: 'string' }, description: 'List of topics to cover' },
          goal: { type: 'string', enum: ['interview', 'exam', 'mastery', 'custom'], description: 'Learning goal type' },
          days: { type: 'number', description: 'Total number of days for the plan' },
          hours_per_day: { type: 'number', description: 'Available hours per day (default 2)' },
          save_as_page: { type: 'boolean', description: 'Whether to save plan as a page' },
        },
        required: ['topics', 'goal', 'days'],
      },
    },
  },
]

export function buildPlanMarkdown(
  topics: string[], goal: string, days: number, hoursPerDay: number = 2
): string {
  const topicsPerDay = Math.max(1, Math.floor(topics.length / (days * 0.7)))
  let md = `# 🗺️ Learning Plan\n**Goal:** ${goal} | **Duration:** ${days} days | **${hoursPerDay}h/day**\n\n`
  md += `## Topics to Cover\n${topics.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n`
  md += `## Daily Schedule\n`

  let topicIdx = 0
  for (let d = 1; d <= days; d++) {
    const isRevision = d % 7 === 0
    if (isRevision) {
      md += `\n### Day ${d} — 🔄 Revision Day\n- [ ] Review week's topics\n- [ ] Practice problems\n- [ ] Update weak areas list\n`
    } else {
      const dayTopics = topics.slice(topicIdx, topicIdx + topicsPerDay)
      topicIdx += topicsPerDay
      md += `\n### Day ${d}\n`
      dayTopics.forEach((t) => {
        md += `- [ ] Learn: ${t}\n- [ ] Practice: ${t} exercises\n`
      })
    }
    if (d % 3 === 0) md += `> 📍 Checkpoint: Self-assess progress\n`
  }

  md += `\n## Checkpoints\n- [ ] Week 1: Foundation review\n- [ ] Week 2: Mid-plan assessment\n- [ ] Final: Full mock ${goal === 'interview' ? 'interview' : 'test'}\n`
  return md
}
