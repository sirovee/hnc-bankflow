import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const sb = createAdminClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data } = await sb.from('correction_mappings').select('*').or(`user_id.eq.${user.id},is_global.eq.true`).order('trust_score', { ascending: false })
  return NextResponse.json({ mappings: data || [] })
}

export async function DELETE(req: NextRequest) {
  const sb = createAdminClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await sb.from('correction_mappings').delete().eq('id', id).eq('user_id', user.id)
  return NextResponse.json({ deleted: true })
}
