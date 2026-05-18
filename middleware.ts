import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS  = ['/login', '/register', '/api/auth', '/_next', '/favicon', '/public']
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  'https://hnc-bankflow.vercel.app',
  'https://bankflow.hudsonweir.co.uk',
  'http://localhost:3000',
].filter(Boolean) as string[]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const origin       = req.headers.get('origin')

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin':  origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
        'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Max-Age':       '86400',
      },
    })
  }

  // Skip auth for public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()

  let res = NextResponse.next({ request: { headers: req.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get:    (n)     => req.cookies.get(n)?.value,
        set:    (n,v,o) => { req.cookies.set({name:n,value:v,...o}); res=NextResponse.next({request:{headers:req.headers}}); res.cookies.set({name:n,value:v,...o}) },
        remove: (n,o)   => { req.cookies.set({name:n,value:'',...o}); res=NextResponse.next({request:{headers:req.headers}}); res.cookies.set({name:n,value:'',...o}) },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users
  if (!user) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)'],
}
