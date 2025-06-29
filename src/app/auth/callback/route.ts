import { createClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Redirect to home page after successful authentication
      return NextResponse.redirect(`${origin}/`)
    }
  }

  // Return the user to an error page with some instructions
  return NextResponse.redirect(`${origin}/auth?error=auth-code-error`)
}