import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types'

// Client-side Supabase client (safe to use in 'use client' components)
export const createClient = () =>
  createClientComponentClient<Database>()

// Supabase storage helpers
export const getPublicUrl = (bucket: string, path: string) => {
  const client = createClient()
  const { data } = client.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export const uploadFile = async (
  bucket: string,
  path: string,
  file: File
) => {
  const client = createClient()
  const { data, error } = await client.storage
    .from(bucket)
    .upload(path, file, { upsert: true })

  if (error) throw error
  return data
}
