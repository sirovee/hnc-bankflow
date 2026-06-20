import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { GoogleAuth } from 'google-auth-library'

export const runtime = 'nodejs'
export const maxDuration = 60
export const preferredRegion = ['lhr1']

const TYPE_CODES = ['POS','DPC','POC','CHG','BAC','S/O','D/D','SBT','FPO','BGC','TRF','ATM','TFR','CR','DR']

// ──────────────────────────────────────────────────────────────
// Resolve a Doc AI layout textAnchor into the actual text string
// ──────────────────────────────────────────────────────────────
function textFromAnchor(fullText: string, layout: any): string {
  const segs = layout?.textAnchor?.textSegments
  if (!segs || !segs.length) return ''
  let out = ''
  for (const s of segs) {
    const start = parseInt(s.startIndex || '0', 10)
    const end   = parseInt(s.endIndex   || '0', 10)
    out += fullText.slice(start, end)
  }
  return out.replace(/\s+/g, ' ').trim()
}

// ──────────────────────────────────────────────────────────────
// LAYER 1: Native table extraction (generic — works across banks)
// ──────────────────────────────────────────────────────────────
function parseFromTables(document: any): any[] {
  const fullText = document?.text || ''
  const rows: any[] = []
  const pages = document?.pages || []

  for (const page of pages) {
    for (const table of (page.tables || [])) {
      const allRows = [...(table.headerRows || []), ...(table.bodyRows || [])]
      if (!allRows.length) continue

      // Identify columns from header
      const header = (table.headerRows?.[0]?.cells || []).map((c: any) =>
        textFromAnchor(fullText, c.layout).toLowerCase()
      )
      const colIdx = {
        date:    header.findIndex((h: string) => /date/.test(h)),
        type:    header.findIndex((h: string) => /type|code/.test(h)),
        desc:    header.findIndex((h: string) => /desc|detail|narrative|transaction|reference/.test(h)),
        paidin:  header.findIndex((h: string) => /paid in|credit|received|money in|deposit/.test(h)),
        paidout: header.findIndex((h: string) => /paid out|debit|withdrawn|money out|payment/.test(h)),
        balance: header.findIndex((h: string) => /balance/.test(h)),
      }

      for (const bodyRow of (table.bodyRows || [])) {
        const cells = (bodyRow.cells || []).map((c: any) => textFromAnchor(fullText, c.layout))
        const get = (i: number) => (i >= 0 && i < cells.length ? cells[i] : '')
        const cleanAmt = (s: string) => {
          if (!s) return ''
          const n = parseFloat(s.replace(/[£$€,\s]/g, ''))
          return isNaN(n) ? '' : n.toFixed(2)
        }
        const date = get(colIdx.date)
        const desc = get(colIdx.desc)
        if (!date && !desc) continue
        rows.push({
          date, txtype: get(colIdx.type), description: desc || '—',
          paidin: cleanAmt(get(colIdx.paidin)),
          paidout: cleanAmt(get(colIdx.paidout)),
          balance: cleanAmt(get(colIdx.balance)),
          _src: 'table'
        })
      }
    }
  }
  return rows
}

// ──────────────────────────────────────────────────────────────
// LAYER 3: NatWest-style regex fallback (proven, keeps working)
// ──────────────────────────────────────────────────────────────
function parseFromText(document: any): any[] {
  const rawText = document?.text || ''
  if (!rawText) return []
  const transactions: any[] = []
  const dateRx  = /^(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i
  const dateRxG = /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/gi
  const amtTest = /£?\d{1,3}(?:,\d{3})*\.\d{2}/
  const noise   = /^(Date Type|Page \d|©|National Westminster|Authorised|Your transactions|Showing:|Account |Sort code|Transactions$)/i

  function toISO(d: string): string {
    const m = d.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i)
    if (!m) return d
    const months: Record<string,string> = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'}
    return `${m[3]}-${months[m[2].toLowerCase()]}-${m[1].padStart(2,'0')}`
  }
  function splitByDates(b: string): string[] {
    const matches = Array.from(b.matchAll(dateRxG))
    if (matches.length <= 1) return [b]
    const segs: string[] = []
    for (let k = 0; k < matches.length; k++) {
      const start = matches[k].index ?? 0
      const end   = k + 1 < matches.length ? (matches[k+1].index ?? b.length) : b.length
      segs.push(b.slice(start, end).trim())
    }
    return segs
  }

  const lines = rawText.split('\n').map((l: string) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const blocks: string[] = []
  let current = ''
  for (const line of lines) {
    if (dateRx.test(line)) {
      if (current && amtTest.test(current)) { blocks.push(current); current = line }
      else if (current) { current += ' ' + line }
      else { current = line }
    } else if (current) {
      if (noise.test(line)) continue
      current += ' ' + line
    }
  }
  if (current) blocks.push(current)
  const splitBlocks: string[] = []
  for (const b of blocks) splitBlocks.push(...splitByDates(b))

  for (const block of splitBlocks) {
    const dm = block.match(dateRx)
    if (!dm) continue
    const date = toISO(dm[1])
    let rest = block.slice(dm[1].length).trim()
    let txtype = ''
    for (const code of TYPE_CODES) {
      const re = new RegExp('^' + code.replace('/', '\\/') + '\\b')
      if (re.test(rest)) { txtype = code; rest = rest.slice(code.length).trim(); break }
    }
    const amtMatches = Array.from(rest.matchAll(/£?(\d{1,3}(?:,\d{3})*\.\d{2})/g))
    const amounts = amtMatches.map(m => m[1].replace(/,/g, ''))
    let desc = rest
    if (amtMatches.length > 0) desc = rest.slice(0, amtMatches[0].index).trim()
    desc = desc.replace(/\s+,/g, ',').replace(/,\s*$/, '').trim()
    let paidin = '', paidout = '', balance = ''
    if (amounts.length >= 2) {
      balance = amounts[amounts.length - 1]
      const amt = amounts[amounts.length - 2]
      const isCredit = /^(BAC|POC)$/.test(txtype) || /from a\/c|lopay|nanosoft tech|payer|receipt|refund|deposit/i.test(desc)
      if (isCredit && !/to a\/c/i.test(desc)) { paidin = amt; paidout = '' }
      else { paidout = amt; paidin = '' }
    } else if (amounts.length === 1) {
      balance = amounts[0]
    }
    const hasContent = amounts.length > 0 || (desc && desc.replace(/[—\s]/g, '').length > 1)
    if (date && hasContent) {
      transactions.push({ date, txtype, description: desc || '—', paidin, paidout, balance, _src: 'text' })
    }
  }
  return transactions
}

// ──────────────────────────────────────────────────────────────
// Master parser: try tables first, fall back to text
// ──────────────────────────────────────────────────────────────
function parseTransactions(document: any, mappings: any[]): any[] {
  const corrMap: Record<string, string> = {}
  for (const m of (mappings || [])) {
    if (m.original_text) corrMap[m.original_text.toUpperCase()] = m.corrected_text
  }
  function fix(text: string): string {
    if (!text) return text
    for (const [k, v] of Object.entries(corrMap)) {
      if (text.toUpperCase().includes(k)) return text.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), v)
    }
    return text
  }

  let rows = parseFromTables(document)
  if (rows.length < 2) rows = parseFromText(document)  // tables failed → regex

  return rows.map(r => ({
    id: Math.random().toString(36).slice(2),
    date: r.date, txtype: r.txtype || '', description: fix(r.description || '—'),
    paidin: r.paidin || '', paidout: r.paidout || '', balance: r.balance || '',
    _confidence: null, _page: null, _auto_corrected: false, _suggested: false, _suggestion: null,
    _ocr: { date: r.date, txtype: r.txtype, description: r.description, paidin: r.paidin, paidout: r.paidout, balance: r.balance },
    _match: { matched:false, corrected_text:'', category:null, match_type:'none', similarity:0, trust_score:0, overrode_ai:false, entry_id:null }
  }))
}

export async function POST(req: NextRequest) {
  try {
    const authClient = createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised. Please sign in again.' }, { status: 401 })

    const sb = createAdminClient()
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'File too large. Max 20MB.' }, { status: 400 })

    const { data: mappings } = await sb.from('correction_mappings')
      .select('original_text,corrected_text,category')
      .or(`user_id.eq.${user.id},is_global.eq.true`)

    const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || ''
    if (!rawJson) return NextResponse.json({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON not set' }, { status: 500 })
    let creds: any
    try { creds = JSON.parse(rawJson) }
    catch { return NextResponse.json({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON is invalid JSON' }, { status: 500 }) }
    if (creds.private_key) creds.private_key = creds.private_key.replace(/\\n/g, String.fromCharCode(10)).replace(/\n/g, String.fromCharCode(10))

    const location    = (process.env.GOOGLE_LOCATION     || 'eu').toLowerCase().trim()
    const projectId   = (process.env.GOOGLE_PROJECT_ID   || '').trim()
    const processorId = (process.env.GOOGLE_PROCESSOR_ID || '').trim()
    if (!projectId || !processorId) return NextResponse.json({ error: 'Missing GOOGLE_PROJECT_ID or GOOGLE_PROCESSOR_ID' }, { status: 500 })

    const auth   = new GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/cloud-platform'] })
    const client = await auth.getClient()
    const token  = await client.getAccessToken()
    if (!token.token) return NextResponse.json({ error: 'Failed to get Google access token' }, { status: 500 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const url    = `https://${location}-documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`
    const gRes = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawDocument: { content: buffer.toString('base64'), mimeType: file.type || 'application/pdf' } })
    })
    if (!gRes.ok) {
      const errBody = await gRes.json().catch(() => ({})) as any
      return NextResponse.json({ error: errBody?.error?.message || `Google API error ${gRes.status}` }, { status: 500 })
    }
    const result = await gRes.json()

    // DEBUG MODE: ?debug=1 returns raw structure summary (no DB write)
    if (new URL(req.url).searchParams.get('debug') === '1') {
      const doc = result.document || {}
      const pages = doc.pages || []
      const summary = {
        textLength: (doc.text || '').length,
        entityCount: (doc.entities || []).length,
        entityTypes: Array.from(new Set((doc.entities || []).map((e: any) => e.type))).slice(0, 30),
        pageCount: pages.length,
        tablesPerPage: pages.map((p: any) => (p.tables || []).length),
        firstTableHeader: (() => {
          for (const p of pages) for (const t of (p.tables || [])) {
            const cells = (t.headerRows?.[0]?.cells || []).map((c: any) => textFromAnchor(doc.text || '', c.layout))
            if (cells.length) return cells
          }
          return []
        })(),
        firstTableRows: (() => {
          for (const p of pages) for (const t of (p.tables || [])) {
            return (t.bodyRows || []).slice(0, 3).map((r: any) =>
              (r.cells || []).map((c: any) => textFromAnchor(doc.text || '', c.layout))
            )
          }
          return []
        })(),
        sampleParseFromTables: parseFromTables(doc).slice(0, 3),
        sampleParseFromText: parseFromText(doc).slice(0, 3),
      }
      return NextResponse.json({ debug: summary })
    }

    const transactions = parseTransactions(result.document, mappings || [])
    void sb.from('rate_limits').insert({
      user_id: user.id, action: 'process_pdf',
      window_key: `${user.id}:pdf:${Math.floor(Date.now() / 3600000)}`
    })
    return NextResponse.json({
      transactions, sessionId: crypto.randomUUID(), fileName: file.name,
      stats: { total: transactions.length, autoCorrected: 0, suggested: 0, lowConfidence: 0, errors: 0, warnings: 0, duplicates: 0, redFlags: 0 }
    })
  } catch (err: any) {
    console.error('[process-pdf]', err)
    return NextResponse.json({ error: 'V3-' + (err?.message || 'Unexpected server error') }, { status: 500 })
  }
}
