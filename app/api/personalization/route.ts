import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { detectWeakAreas, extractContextFromText, generateContextId } from '@/lib/personalization'
import type { UserMemory } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { action, memory, messages, text, name, type } = await req.json() as {
      action: 'analyze' | 'add_context' | 'update_preferences' | 'detect_weak_areas'
      memory?: Partial<UserMemory>
      messages?: { role: string; content: string }[]
      text?: string
      name?: string
      type?: string
    }

    if (action === 'analyze' && messages) {
      const weakAreas = detectWeakAreas(messages)
      return NextResponse.json({ weakAreas, analyzed: messages.length })
    }

    if (action === 'add_context' && text) {
      const content = extractContextFromText(text)
      const ctx = {
        id: generateContextId(),
        name: name || 'Uploaded context',
        type: type || 'notes',
        content,
        uploadedAt: new Date().toISOString(),
      }
      return NextResponse.json({ context: ctx })
    }

    if (action === 'update_preferences') {
      return NextResponse.json({ updated: true, memory })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
