import Groq from 'groq-sdk'
type Tool = Groq.Chat.Completions.ChatCompletionTool

export const getGroqClient = (userApiKey?: string | null) => {
  return new Groq({
    apiKey: userApiKey || process.env.GROQ_API_KEY,
  })
}

export const MODEL = 'llama-3.3-70b-versatile'

export const GROQ_MODELS = [
  { id: 'llama-3.3-70b-versatile',                   name: 'Llama 3.3 70B',        desc: 'Best quality, great for complex tasks',    rpm: 30, rpd: 1000,  tag: 'Recommended', speed: 'Medium', supportsTools: true  },
  { id: 'llama-3.1-8b-instant',                      name: 'Llama 3.1 8B Instant', desc: 'Fastest responses, very high daily limit', rpm: 30, rpd: 14400, tag: 'Fast',        speed: 'Fast',   supportsTools: true  },
  { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B',    desc: 'Balanced speed and quality, new model',    rpm: 30, rpd: 1000,  tag: 'New',         speed: 'Medium', supportsTools: true, supportsVision: true  },
  { id: 'groq/compound-mini',                        name: 'Compound Mini',         desc: 'Reasoning-optimised, lower daily limit',  rpm: 30, rpd: 250,   tag: 'Reasoning',   speed: 'Slow',   supportsTools: false },
  { id: 'moonshotai/kimi-k2-instruct',               name: 'Kimi K2',               desc: 'High requests/min, good for quick tasks', rpm: 60, rpd: 1000,  tag: 'High RPM',    speed: 'Medium', supportsTools: false },
] as const

export type GroqModelId = typeof GROQ_MODELS[number]['id']
export const DEFAULT_MODEL: GroqModelId = GROQ_MODELS[0].id

export const SYSTEM_PROMPT = `You are Noted AI, an intelligent assistant embedded in a Notion-like note-taking app called "Noted".
You help users manage their workspace, create pages, search content, and draft notes.

You have access to tools to interact with the workspace. Always be helpful, concise, and accurate.
When creating pages, use relevant emojis for icons. Format content in a clear, structured way.
If asked to create structured content, use headings, bullet points, and formatting.

TOOL CALL RULES (CRITICAL):
- The 'content' arg in create_page/update_page_content must be concise markdown, max 800 characters.
- NEVER include explanations or analysis inside the content arg — those go in your chat response.
- NEVER wrap content in triple backticks inside tool arguments.`

export const AGENT_TOOLS: Tool[] = [
  {
    type: 'function',
    function: {
      name: 'create_page',
      description: 'Create a new page in the workspace with optional content',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The page title' },
          icon: { type: 'string', description: 'An emoji icon for the page' },
          content: { type: 'string', description: 'Markdown content for the page body' },
          parent_id: { type: 'string', description: 'Optional parent page ID for nesting' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_pages',
      description: 'Search for pages in the workspace by title',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_page_content',
      description: 'Get the content of a specific page',
      parameters: {
        type: 'object',
        properties: {
          page_id: { type: 'string', description: 'The page ID' },
          title: { type: 'string', description: 'The page title to search by (alternative to page_id)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_page_title',
      description: 'Rename a page',
      parameters: {
        type: 'object',
        properties: {
          page_id: { type: 'string', description: 'The page ID to rename' },
          new_title: { type: 'string', description: 'The new title' },
        },
        required: ['page_id', 'new_title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_page_content',
      description: 'Write or overwrite the body content of an existing page using markdown. Keep content concise and well-structured. Do NOT include raw code blocks longer than 50 lines.',
      parameters: {
        type: 'object',
        properties: {
          page_id: { type: 'string', description: 'The page ID to update' },
          content: { type: 'string', description: 'The new markdown content for the page body. Max ~2000 characters. Summarize long content instead of pasting verbatim.' },
        },
        required: ['page_id', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_pages',
      description: 'List all pages in the workspace',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
]
