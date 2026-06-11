import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { DocumentProcessorServiceClient } from '@google-cloud/documentai'

const ERRORS: Record<number, string> = {
  400: 'The document could not be processed — it may be corrupted or password-protected.',
  401: 'Authentication failed. Check your service account JSON.',
  403: 'Permission denied. Ensure Document AI API is enabled and your service account has the Document AI API User role.',
  404: 'Processor not found. Check your Project ID, Processor ID and Region.',
  429: 'Rate limit exceeded. Please wait and try again.',
  500: 'Google Cloud error. Please try again shortly.',
}

// Parse Doc AI response into transaction rows
function parseTransactions(document: any, mappings: any[]): any[] {
  const entities  = document?.entities  || []
  const rawText   = document?.text      || ''
  const transactions: any[] = []

  // Build correction map
  const corrMap: Record<string, string> = {}
  for (const m of mappings) {
    corrMap[m.original_text?.toUpperCase()] = m.corrected_text
  }

  function applyCorrections(text: string): string {
    if (!text) return text
    const upper = text.toUpperCase()
    for (const [orig, corr] of Object.entries(corrMap)) {
      if (upper.includes(orig)) return text.replace(new RegExp(orig, 'gi'), corr)
    }
    return text
  }

  function cleanAmt(s: string): string {
    if (!s) return ''
    const n = parseFloat(s.replace(/[£$€,\s]/g, ''))
    return isNaN(n) ? '' : n.toFixed(2)
  }

  function getVal(e: any): string {
    return e?.normalizedValue?.text || e?.mentionText || ''
  }

  // Layer 1: Doc AI structured entities
  for (const entity of entities) {
    const t = (entity.type || '').toLowerCase()
    if (t.includes('transaction') || t.includes('line_item') || t.includes('entry')) {
      const tx: any = { date: '', txtype: '', description: '', paidin: '', paidout: '', balance: '', _confidence: entity.confidence ?? null, _page: null, _ocr: {}, _auto_corrected: false, _suggested: false, _suggestion: null, _match: { matched: false, corrected_text: '', category: null, match_type: 'none', similarity: 0, trust_score: 0, overrode_ai: false, entry_id: null }, id: Math.random().toString(36).slice(2) }
      for (const p of (entity.properties || [])) {
        const pt = (p.type || '').toLowerCase()
        const pv = getVal(p)
        if (pt.includes('date'))                                              tx.date        = pv
        else if (pt === 'transaction_type' || pt === 'type' || pt === 'code') tx.txtype      = pv
        else if (pt.includes('desc') || pt.includes('narr'))                  tx.description = applyCorrections(pv)
        else if (pt.includes('credit') || pt.includes('paid_in'))             tx.paidin      = cleanAmt(pv)
        else if (pt.includes('debit')  || pt.includes('paid_out'))            tx.paidout     = cleanAmt(pv)
        else if (pt.includes('balance'))                                       tx.balance     = cleanAmt(pv)
      }
      tx._ocr = { date: tx.date, txtype: tx.txtype, description: tx.description, paidin: tx.paidin, paidout: tx.paidout, balance: tx.balance }
      if (tx.date || tx.description) transactions.push(tx)
    }
  }

  // Layer 2: Regex fallback on raw text (NatWest / UK bank format)
  if (transactions.length === 0 && rawText) {
    const lines   = rawText.split('\n').map((l: string) => l.trim()).filter(Boolean)
    const dateRx  = /^(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i
    const typeRx  = /\b(POS|DPC|POC|CHG|BAC|S\/O|D\/D|SBT|FPO|BGC|TRF|ATM|CR|DR)\b/i
    const amtRx   = /£?(\d{1,3}(?:,\d{3})*\.\d{2})/g

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
      let desc = full.replace(dateRx, '').replace(typeRx, '').replace(/£?\d{1,3}(?:,\d{3})*\.\d{2}/g, '').replace(/\s+/g, ' ').trim()
      desc = applyCorrections(desc)
      let paidin = '', paidout = '', balance = ''
      if (amounts.length >= 2) {
        balance = amounts[amounts.length - 1]
        const amt = amounts[amounts.length - 2]
        const creditHints = /from|receipt|credit|deposit|refund/i
        if      (creditHints.test(desc) || ['POC', 'BAC'].includes(txtype))                                               paidin  = amt
        else if (['CHG', 'D/D', 'S/O', 'SBT', 'POS'].includes(txtype) || /to a\/c|jaygate|sefe/i.test(desc))             paidout = amt
        else    paidin = amt
      } else if (amounts.length === 1) balance = amounts[0]

      if (date) {
        const id = Math.random().toString(36).slice(2)
        transactions.push({ id, date, txtype, description: desc || '—', paidin, paidout, balance, _confidence: null, _page: null, _ocr: { date, txtype, description: desc || '—', paidin, paidout, balance }, _auto_corrected: false, _suggested: false, _suggestion: null, _match: { matched: false, corrected_text: '', category: null, match_type: 'none', similarity: 0, trust_score: 0, overrode_ai: false, entry_id: null } })
      }
      i = j
    }
  }

  return transactions
}

export async function POST(req: NextRequest) {
  const sb = createAdminClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Rate limit
  const now = new Date(), since = new Date(now.getTime() - 3600000)
  const { count } = await sb.from('rate_limits').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('action', 'process_pdf').gte('created_at', since.toISOString())
  if ((count || 0) >= 10) return NextResponse.json({ error: 'Rate limit: 10 PDFs per hour.' }, { status: 429 })

  // Parse file
  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'File too large. Max 20MB.' }, { status: 400 })

  // Fetch user dictionary
  const { data: mappings } = await sb.from('correction_mappings').select('original_text,corrected_text,category,trust_score').or(`user_id.eq.${user.id},is_global.eq.true`)

  let buffer = Buffer.from(await file.arrayBuffer())
  let docResult: any

  try {
    const creds    = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!)
    const location = process.env.GOOGLE_LOCATION || 'eu'
    const client   = new DocumentProcessorServiceClient({ credentials: creds, apiEndpoint: `${location}-documentai.googleapis.com` })
    const name     = `projects/${process.env.GOOGLE_PROJECT_ID}/locations/${location}/processors/${process.env.GOOGLE_PROCESSOR_ID}`
    const [res]    = await client.processDocument({ name, rawDocument: { content: buffer.toString('base64'), mimeType: file.type || 'application/pdf' } })
    docResult = res
  } catch (err: any) {
    const code = err?.code || 500
    return NextResponse.json({ error: ERRORS[code] || err.message }, { status: 500 })
  } finally {
    buffer.fill(0) // GDPR: clear from memory
  }

  // Parse into transactions
  const transactions = parseTransactions(docResult.document, mappings || [])
  const stats = {
    total:         transactions.length,
    autoCorrected: transactions.filter((t: any) => t._auto_corrected).length,
    suggested:     transactions.filter((t: any) => t._suggested).length,
    lowConfidence: transactions.filter((t: any) => t._confidence !== null && t._confidence < 0.8).length,
    errors: 0, warnings: 0, duplicates: 0, redFlags: 0,
  }

  // Record rate limit usage
  await sb.from('rate_limits').insert({ user_id: user.id, action: 'process_pdf', window_key: `${user.id}:pdf:${Math.floor(now.getTime() / 3600000)}` })

  return NextResponse.json({ transactions, sessionId: crypto.randomUUID(), fileName: file.name, stats })
}
