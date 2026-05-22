import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch (error) {
              // Ignore if called from a Server Component
            }
          },
        },
      }
    )

    // Exchange the code for a session (This now correctly sets the cookie in the browser)
    await supabase.auth.exchangeCodeForSession(code)

    // --- VIP ALLOWLIST ---
    const ALLOWED_EMAILS = [
      'hello@skreed.com',
      'service@skreed.com',
      'skreed.me@gmail.com',
      'prem@zeosmobile.com',
      'sowmya@zeosmobile.com',
      'sohan@zeosmobile.com',
      'sonamm@zeosmobile.com',
      'jyotikat@zeosmobile.com',
      'samkamalesan05@gmail.com',
      'zeosindia@outlook.com'
    ]

    const { data: { user } } = await supabase.auth.getUser()

    // The Kick-Out Logic
    if (user && !ALLOWED_EMAILS.includes(user.email.toLowerCase())) {
      await supabase.auth.signOut()
      return NextResponse.redirect(`${origin}/login?error=Access Denied: Unauthorized Email`)
    }
  }

  // If successful, send them to the main dashboard
  return NextResponse.redirect(`${origin}/`)
}
