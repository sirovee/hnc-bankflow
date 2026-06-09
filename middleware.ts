import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const PUBLIC = ['/login', '/register', '/_next', '/favicon', '/api/auth']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next()

  let res = NextResponse.next({ request: { headers: req.headers } })

  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          req.cookies.set({ name, value, ...options })
          res = NextResponse.next({ request: { headers: req.headers } })
          res.cookies.set({ name, value, ...options })
        },
        remove: (name: string, options: CookieOptions) => {
          req.cookies.set({ name, value: '', ...options })
          res = NextResponse.next({ request: { headers: req.headers } })
          res.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await sb.auth.getUser()
  if (!user) {
    const url = new URL('/login', req.url)
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)'],
}
