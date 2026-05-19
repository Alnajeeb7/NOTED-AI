import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getGroqClient, DEFAULT_MODEL } from '@/lib/groq'

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { prompt, text } = await req.json()
    if (!prompt || !text) return NextResponse.json({ error: 'Missing prompt or text' }, { status: 400 })

    const groq = getGroqClient()
    const response = await groq.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an inline writing assistant. Return only the transformed text with no commentary, preamble, or explanation. Output just the result.',
        },
        {
          role: 'user',
          content: `${prompt}\n\n"${text}"`,
        },
      ],
      max_tokens: 1024,
      temperature: 0.3,
    })

    const content = response.choices[0]?.message?.content?.trim() || text
    return NextResponse.json({ content })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI request failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
