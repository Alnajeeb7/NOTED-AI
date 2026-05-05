import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { userId, email } = await req.json()
    if (!userId || !email) {
      return NextResponse.json({ error: 'Missing userId or email' }, { status: 400 })
    }

    // Create workspace
    const { data: workspace, error: wsError } = await supabaseAdmin
      .from('workspaces')
      // @ts-ignore
      .insert({ name: `${email.split('@')[0]}'s workspace`, owner_id: userId, icon: '🗒️' })
      .select()
      .single()

    if (wsError) throw wsError

    // Upsert user profile
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      // @ts-ignore
      .upsert({ id: userId, email, workspace_id: workspace.id })

    if (profileError) throw profileError

    return NextResponse.json({ workspaceId: workspace.id })
  } catch (err: unknown) {
    console.error('Setup error:', err)
    const e = err as { message?: string }
    return NextResponse.json({ error: e.message || 'Setup failed' }, { status: 500 })
  }
}
