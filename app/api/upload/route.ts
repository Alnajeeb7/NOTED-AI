import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'note-images',
  'image/png': 'note-images',
  'image/gif': 'note-images',
  'image/webp': 'note-images',
  'video/mp4': 'note-videos',
  'video/webm': 'note-videos',
  'video/ogg': 'note-videos',
  'video/quicktime': 'note-videos',
}

const MAX_SIZE: Record<string, number> = {
  'note-images': 10 * 1024 * 1024,  // 10 MB
  'note-videos': 100 * 1024 * 1024, // 100 MB
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const bucket = ALLOWED_TYPES[file.type]
  if (!bucket) return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })

  if (file.size > MAX_SIZE[bucket])
    return NextResponse.json({ error: `File too large (max ${MAX_SIZE[bucket] / 1024 / 1024} MB)` }, { status: 400 })

  const ext = file.name.split('.').pop()
  const path = `${session.user.id}/${Date.now()}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path)

  return NextResponse.json({ url: publicUrl })
}
