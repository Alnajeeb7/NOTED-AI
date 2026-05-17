import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { ApiKeyProvider } from '@/types'

// NOTE: API keys are stored in localStorage on the client side for security.
// This route handles validation only — keys are never sent to the server unencrypted.
// For production, use an encrypted server-side store (e.g., Supabase vault).

const PROVIDER_PREFIXES: Record<ApiKeyProvider, string> = {
  openai: 'sk-',
  claude: 'sk-ant-',
  groq: 'gsk_',
  gemini: 'AIza',
  platform: 'noted_',
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { action, provider, key, label } = await req.json() as {
      action: 'validate' | 'generate_platform_key'
      provider?: ApiKeyProvider
      key?: string
      label?: string
    }

    if (action === 'validate') {
      if (!key || !provider) return NextResponse.json({ error: 'Missing key or provider' }, { status: 400 })

      const expectedPrefix = PROVIDER_PREFIXES[provider]
      const isValidFormat = expectedPrefix ? key.startsWith(expectedPrefix) : key.length > 10

      return NextResponse.json({
        valid: isValidFormat,
        message: isValidFormat ? 'Key format looks valid' : `Expected key starting with "${expectedPrefix}"`,
        keyPrefix: key.slice(0, 8) + '...',
      })
    }

    if (action === 'generate_platform_key') {
      // Generate a platform API key for the user (for external integrations)
      const platformKey = `noted_${Buffer.from(session.user.id).toString('base64').slice(0, 8)}_${Math.random().toString(36).slice(2, 18)}`
      return NextResponse.json({
        key: platformKey,
        keyPrefix: platformKey.slice(0, 16) + '...',
        createdAt: new Date().toISOString(),
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  // Returns usage stats for the current session (placeholder — extend with DB later)
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    return NextResponse.json({
      userId: session.user.id,
      platformUsage: { calls: 0, tokensUsed: 0, resetAt: new Date(Date.now() + 86400000).toISOString() },
      limits: { free: 100, pro: 1000, enterprise: 'unlimited' },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 })
  }
}
