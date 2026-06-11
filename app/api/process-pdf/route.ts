import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

function parseTransactions(document: any, mappings: any[]): any[] {
  const rawText = document?.text || ''
  const transactions: any[] = []

  const corrMap: Record<string, string> = {}
  for (const m of (mappings || [])) {
    if (m.original_text) corrMap[m.original_text.toUpperCase()] = m.corrected_text
  }

  function applyCorrections(text: string): string {
    if (!text) return text
    for (const [orig, corr] of Object.entries(corrMap)) {
      if (text.toUpperCase().includes(orig)) return text.replace(new RegExp(orig, 'gi'), corr)
    }
    return text
  }

  function cleanAmt(s: string): string {
    if (!s) return ''
    const n = parseFloat(s.replace(/[£$€,\s]/g, ''))
    return isNaN(n) ? '' : n.toFixed(2)
  }

  if (rawText) {
    const lines  = rawText.split('\n').map((l: string) => l.trim()).filter(Boolean)
    const dateRx = /^(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i
    const typeRx = /\b(POS|DPC|POC|CHG|BAC|S\/O|D\/D|SBT|FPO|BGC|TRF|ATM|CR|DR)\b/i
    const amtRx  = /£?(\d{1,3}(?:,\d{3})*\.\d{2})/g

    let i = 0
    while (i < lines.length) {
      const dm = lines[i].match(dateRx)
      if (!dm) { i++; continue }
      let full = lines[i], j = i + 1
      while (j < lines.length && !lines[j].match(dateRx)) {
        full += ' ' + lines[j]; j++
        if ([...full.matchAll(amtRx)].length >= 2) break
      }
      const date    = dm[1]
      const tm      = full.match(typeRx)
      const txtype  = tm ? tm[1].toUpperCase() : ''
      const amounts = [...full.matchAll(amtRx)].map((m: any) => m[1].replace(/,/g, ''))
      let desc = full.replace(dateRx, '').replace(typeRx, '')
        .replace(/£?\d{1,3}(?:,\d{3})*\.\d{2}/g, '').replace(/\s+/g, ' ').trim()
      desc = applyCorrections(desc)
      let paidin = '', paidout = '', balance = ''
      if (amounts.length >= 2) {
        balance = amounts[amounts.length - 1]
        const amt = amounts[amounts.length - 2]
        if (/from|receipt|deposit|refund/i.test(desc) || ['POC','BAC'].includes(txtype)) paidin = amt
        else if (['CHG','D/D','S/O','SBT','POS'].includes(txtype) || /to a\/c/i.test(desc)) paidout = amt
        else paidin = amt
      } else if (amounts.length === 1) balance = amounts[0]

      if (date) transactions.push({
        id: Math.random().toString(36).slice(2),
        date, txtype, description: desc || '—', paidin, paidout, balance,
        _confidence: null, _page: null, _auto_corrected: false,
        _suggested: false, _suggestion: null,
        _ocr: { date, txtype, description: desc||'—', paidin, paidout, balance },
        _match: { matched:false, corrected_text:'', category:null, match_type:'none', similarity:0, trust_score:0, overrode_ai:false, entry_id:null }
      })
      i = j
    }
  }
  return transactions
}

export async function POST(req: NextRequest) {
  try {
    const sb = createAdminClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'File too large. Max 20MB.' }, { status: 400 })

    const { data: mappings } = await sb.from('correction_mappings')
      .select('original_text,corrected_text,category')
      .or(`user_id.eq.${user.id},is_global.eq.true`)

    // Parse Google credentials
    let creds: any
    try {
      const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || ''
      creds = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Invalid GOOGLE_SERVICE_ACCOUNT_JSON — check Vercel env vars' }, { status: 500 })
    }

    const location    = (process.env.GOOGLE_LOCATION || 'eu').toLowerCase()
    const projectId   = process.env.GOOGLE_PROJECT_ID
    const processorId = process.env.GOOGLE_PROCESSOR_ID
    if (!projectId || !processorId) {
      return NextResponse.json({ error: 'Missing GOOGLE_PROJECT_ID or GOOGLE_PROCESSOR_ID env vars' }, { status: 500 })
    }

    // Call Document AI via REST (avoids gRPC issues on Vercel)
    const { GoogleAuth } = await import('google-auth-library')
    const auth   = new GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/cloud-platform'] })
    const client = await auth.getClient()
    const token  = await client.getAccessToken()

    const buffer  = Buffer.from(await file.arrayBuffer())
    const content = buffer.toString('base64')
    const url     = `https://${location}-documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawDocument: { content, mimeType: file.type || 'application/pdf' } })
    })

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}))
      const msg = (errBody as any)?.error?.message || `HTTP ${response.status}`
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const result      = await response.json()
    const transactions = parseTransactions(result.document, mappings || [])

    return NextResponse.json({
      transactions,
      sessionId: crypto.randomUUID(),
      fileName:  file.name,
      stats: { total: transactions.length, autoCorrected: 0, suggested: 0, lowConfidence: 0, errors: 0, warnings: 0, duplicates: 0, redFlags: 0 }
    })

  } catch (err: any) {
    console.error('process-pdf error:', err)
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 })
  }
}
