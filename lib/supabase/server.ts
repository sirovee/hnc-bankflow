import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const c = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => c.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          try { c.set({ name, value, ...options }) } catch {}
        },
        remove: (name: string, options: CookieOptions) => {
          try { c.set({ name, value: '', ...options }) } catch {}
        },
      },
    }
  )
}

export function createAdminClient() {
  const c = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get: (name: string) => c.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          try { c.set({ name, value, ...options }) } catch {}
        },
        remove: (name: string, options: CookieOptions) => {
          try { c.set({ name, value: '', ...options }) } catch {}
        },
      },
    }
  )
}
