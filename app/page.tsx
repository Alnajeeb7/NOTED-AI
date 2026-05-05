import { createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function RootPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  const userId = session.user.id
  const email = session.user.email ?? ''

  // Try to get existing profile
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('workspace_id')
    .eq('id', userId)
    .single()

  if (profile?.workspace_id) {
    redirect(`/workspace/${profile.workspace_id}`)
  }

  // No profile yet — create workspace + profile (handles Google OAuth users)
  const { data: workspace, error: wsError } = await supabaseAdmin
    .from('workspaces')
    // @ts-ignore
    .insert({
      name: `${email.split('@')[0]}'s workspace`,
      owner_id: userId,
      icon: '🗒️',
    })
    .select()
    .single()

  if (wsError || !workspace) {
    // Workspace creation failed — send to login with error
    redirect('/login?error=setup')
  }

  await supabaseAdmin
    .from('user_profiles')
    // @ts-ignore
    .upsert({ id: userId, email, workspace_id: workspace.id })

  redirect(`/workspace/${workspace.id}`)
}
