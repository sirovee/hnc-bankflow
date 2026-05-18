import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get:    (n)   => cookieStore.get(n)?.value,
        set:    (n,v,o) => { try { cookieStore.set({ name:n, value:v, ...o }) } catch {} },
        remove: (n,o)   => { try { cookieStore.set({ name:n, value:'', ...o }) } catch {} },
      },
    }
  )
}

export function createAdminClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get:    (n)   => cookieStore.get(n)?.value,
        set:    (n,v,o) => { try { cookieStore.set({ name:n, value:v, ...o }) } catch {} },
        remove: (n,o)   => { try { cookieStore.set({ name:n, value:'', ...o }) } catch {} },
      },
    }
  )
}
