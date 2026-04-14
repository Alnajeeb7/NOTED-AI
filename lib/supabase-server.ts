import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Database } from '@/types'

// Server-side Supabase client (only use in Server Components / Route Handlers)
export const createServerClient = () =>
  createServerComponentClient<Database>({ cookies })
