import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Check if environment variables are properly configured
  if (!supabaseUrl || !supabaseAnonKey || 
      supabaseUrl === 'your_supabase_project_url' || 
      supabaseAnonKey === 'your_supabase_anon_key') {
    console.error('⚠️ Supabase environment variables are not configured!')
    console.error('Please update your .env.local file with real Supabase credentials.')
    console.error('See SUPABASE_SETUP.md for instructions.')
    
    // Return a mock client to prevent crashes during development
    return null as unknown as ReturnType<typeof createBrowserClient<Database>>
  }

  return createBrowserClient<Database>(
    supabaseUrl,
    supabaseAnonKey
  )
}