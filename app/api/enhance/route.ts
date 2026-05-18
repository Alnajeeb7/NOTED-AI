import { NextRequest, NextResponse } from 'next/server'
import { getGroqClient } from '@/lib/groq'

export async function POST(req: NextRequest) {
  try {
    const { raw, context, sysPrompt } = await req.json()

    if (!raw) return NextResponse.json({ error: 'No input' }, { status: 400 })

    const groq = getGroqClient()
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 300,
      temperature: 0.7,
      messages: [
        { role: 'system', content: sysPrompt },
        {
          role: 'user',
          content: `Context: ${context || 'No files attached, plain chat mode.'}\nRaw user input: ${raw}\n\nRewrite this into a clear specific prompt:`,
        },
      ],
    })

    const enhanced = response.choices[0]?.message?.content?.trim() || ''
    return NextResponse.json({ enhanced })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Enhancement failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
