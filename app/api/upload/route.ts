import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// POST /api/upload — multipart/form-data with file field
export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // Validate type
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!allowed.includes(file.type))
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })

  // Max 10 MB
  if (file.size > 10 * 1024 * 1024)
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })

  const ext = file.name.split('.').pop()
  const path = `${session.user.id}/${Date.now()}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const { error } = await supabase.storage
    .from('note-images')
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage
    .from('note-images')
    .getPublicUrl(path)

  return NextResponse.json({ url: publicUrl })
}
