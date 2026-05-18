import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const MAX_SIZE   = 2 * 1024 * 1024
const ALLOWED    = ['image/png','image/jpeg','image/webp','image/svg+xml']

export async function POST(req: NextRequest) {
  const sb = createAdminClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('logo') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (!ALLOWED.includes(file.type))
    return NextResponse.json({ error: 'Invalid file type. Use PNG, JPG, WebP or SVG.' }, { status: 400 })
  if (file.size > MAX_SIZE)
    return NextResponse.json({ error: 'Logo must be under 2MB.' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const path   = `logos/${user.id}/logo.png`

  const { error } = await sb.storage.from('company-assets').upload(path, buffer, { contentType: file.type, upsert: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data } = sb.storage.from('company-assets').getPublicUrl(path)
  await sb.from('profiles').update({ logo_url: data.publicUrl }).eq('id', user.id)
  return NextResponse.json({ logo_url: data.publicUrl })
}

export async function GET() {
  const sb = createAdminClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data } = await sb.from('profiles').select('logo_url, company_name').eq('id', user.id).single()
  return NextResponse.json(data || {})
}
