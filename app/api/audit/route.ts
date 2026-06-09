import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const sb = createAdminClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { entries, sessionId, fileName } = await req.json()
  if (!Array.isArray(entries) || !sessionId) return NextResponse.json({ error: 'Invalid' }, { status: 400 })
  const rows = entries.map((e: any) => ({ user_id: user.id, session_id: sessionId, file_name: fileName || 'unknown', row_index: e.row, field_name: e.field, original_val: e.orig, edited_val: e.edited, restored: e.restored || false }))
  await sb.from('audit_logs').insert(rows)
  return NextResponse.json({ saved: rows.length })
}

export async function GET() {
  const sb = createAdminClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data } = await sb.from('audit_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(500)
  return NextResponse.json({ entries: data || [] })
}
