import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name) {
            return request.cookies.get(name)?.value
          },
          set(name, value, options) {
            request.cookies.set({ name, value, ...options })
          },
          remove(name, options) {
            request.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )

    // Exchange the code for a session
    await supabase.auth.exchangeCodeForSession(code)

    // --- VIP ALLOWLIST ---
    // Change these to your actual team emails!
    const ALLOWED_EMAILS = [
      'hello@skreed.com',
      'service@skreed.com',
      'skreed.me@gmail.com',
      'prem@zeosmobile.com',
      'sowmya@zeosmobile.com',
      'sohan@zeosmobile.com',
      'sonamm@zeosmobile.com',
      'jyotikat@zeosmobile.com'
    ]

    const { data: { user } } = await supabase.auth.getUser()

    // The Kick-Out Logic
    if (user && !ALLOWED_EMAILS.map(e => e.toLowerCase()).includes(user.email.toLowerCase())) {
      await supabase.auth.signOut()
      return NextResponse.redirect(`${origin}/login?error=Access Denied: Unauthorized Email`)
    }
  }

  // If successful, send them to the main dashboard
  return NextResponse.redirect(`${origin}/`)
}
