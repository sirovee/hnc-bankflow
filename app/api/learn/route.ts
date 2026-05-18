import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/server'

const GLOBAL_THRESHOLD = 10 // users before auto-promotion

export async function POST(req: NextRequest) {
  const sb = createAdminClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { raw_text, corrected_text, category, remember } = await req.json()
  if (!raw_text?.trim() || !corrected_text?.trim())
    return NextResponse.json({ error: 'raw_text and corrected_text required' }, { status: 400 })
  if (!remember) return NextResponse.json({ saved: false })

  const key = raw_text.trim().toUpperCase()

  // Upsert — increment hit_count on conflict
  const { data: existing } = await sb.from('correction_mappings')
    .select('id, hit_count, unique_user_count')
    .eq('user_id', user.id).eq('original_text', key).single()

  let trustScore = 10
  let promoted   = false

  if (existing) {
    const hits  = (existing.hit_count || 0) + 1
    const users = existing.unique_user_count || 1
    trustScore  = Math.min(100, Math.round(10 + 90 * Math.log10(hits + 1) / Math.log10(201)))
    await sb.from('correction_mappings')
      .update({ hit_count: hits, trust_score: trustScore, category: category||null, updated_at: new Date().toISOString() })
      .eq('id', existing.id)

    // Check global promotion
    if (users >= GLOBAL_THRESHOLD && trustScore >= 75) {
      await sb.from('correction_mappings').update({ is_global: true }).eq('original_text', key)
      promoted = true
    }
  } else {
    await sb.from('correction_mappings').insert({
      user_id: user.id, original_text: key, corrected_text: corrected_text.trim(),
      category: category||null, trust_score: 10, hit_count: 1,
      unique_user_count: 1, is_global: false, confidence_override: 0.8,
    })
  }

  return NextResponse.json({ saved: true, trust_score: trustScore, promoted })
}
