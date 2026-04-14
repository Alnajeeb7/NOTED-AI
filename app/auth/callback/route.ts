import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.exchangeCodeForSession(code)

    if (session?.user) {
      const userId = session.user.id
      const email = session.user.email ?? ''

      // Check if user profile already exists
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('id, workspace_id')
        .eq('id', userId)
        .single()

      if (!profile) {
        // New user — create workspace + profile
        const { data: workspace } = await supabaseAdmin
          .from('workspaces')
          .insert({ name: `${email.split('@')[0]}'s workspace`, owner_id: userId, icon: '🗒️' })
          .select()
          .single()

        if (workspace) {
          await supabaseAdmin
            .from('user_profiles')
            .upsert({ id: userId, email, workspace_id: workspace.id })
        }
      }
    }
  }

  return NextResponse.redirect(new URL('/', requestUrl.origin))
}

