import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { GoogleAuth } from 'google-auth-library'

export const runtime = 'nodejs'
export const maxDuration = 60
export const preferredRegion = ['lhr1']

const TYPE_CODES = ['POS','DPC','POC','CHG','BAC','S/O','D/D','SBT','FPO','BGC','TRF','ATM','TFR','CR','DR']

function parseTransactions(document: any, mappings: any[]): any[] {
  const rawText = document?.text || ''
  const transactions: any[] = []
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
  function cleanAmt(s: string): string {
    if (!s) return ''
    const n = parseFloat(String(s).replace(/[£$€,\s]/g, ''))
    return isNaN(n) ? '' : n.toFixed(2)
  }
  function toISO(d: string): string {
    const m = d.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i)
    if (!m) return d
    const months: Record<string,string> = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'}
    return `${m[3]}-${months[m[2].toLowerCase()]}-${m[1].padStart(2,'0')}`
  }

  if (!rawText) return []

  const lines = rawText.split('\n').map((l: string) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const dateRx = /^(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i

  // Group lines into transaction blocks (each starts with a date)
  const blocks: string[] = []
  let current = ''
  for (const line of lines) {
    if (dateRx.test(line)) {
      if (current) blocks.push(current)
      current = line
    } else if (current) {
      // Skip header/footer noise
      if (/^(Date Type|Page \d|©|National Westminster|Authorised|Your transactions|Showing:|Account |Sort code|Transactions$)/i.test(line)) continue
      current += ' ' + line
    }
  }
  if (current) blocks.push(current)

  for (const block of blocks) {
    const dm = block.match(dateRx)
    if (!dm) continue
    const date = toISO(dm[1])
    let rest = block.slice(dm[1].length).trim()

    // Extract type code (right after date)
    let txtype = ''
    for (const code of TYPE_CODES) {
      const re = new RegExp('^' + code.replace('/', '\\/') + '\\b')
      if (re.test(rest)) { txtype = code; rest = rest.slice(code.length).trim(); break }
    }

    // Extract all amounts in order
    const amtMatches = Array.from(rest.matchAll(/£?(\d{1,3}(?:,\d{3})*\.\d{2})/g))
    const amounts = amtMatches.map(m => m[1].replace(/,/g, ''))

    // Description = everything before the first amount
    let desc = rest
    if (amtMatches.length > 0) {
      desc = rest.slice(0, amtMatches[0].index).trim()
    }
    desc = fix(desc.replace(/\s+,/g, ',').replace(/,\s*$/, '').trim())

    // NatWest format: [Paid in OR Paid out] then [Balance]
    // The LAST amount is always balance. The one before is the transaction amount.
    let paidin = '', paidout = '', balance = ''
    if (amounts.length >= 2) {
      balance = amounts[amounts.length - 1]
      const amt = amounts[amounts.length - 2]
      // Determine in/out by type and description
      const isCredit = /^(BAC|POC)$/.test(txtype) ||
                       /from a\/c|lopay|nanosoft tech|payer/i.test(desc)
      const isDebit  = /^(POS|CHG|S\/O|D\/D|SBT|DPC)$/.test(txtype) &&
                       !/from a\/c/i.test(desc)
      if (isCredit && !/to a\/c/i.test(desc)) paidin = amt
      else if (isDebit || /to a\/c|bbls|loan|edf|castle water|facebk|tesco|kushiara|countrystyle|gocardless|nest|jaygate|sefe|af accountants|unpaid item|squaremile/i.test(desc)) paidout = amt
      else paidin = amt
    } else if (amounts.length === 1) {
      balance = amounts[0]
    }

    if (date) {
      transactions.push({
        id: Math.random().toString(36).slice(2),
        date, txtype, description: desc || '—', paidin, paidout, balance,
        _confidence: null, _page: null, _auto_corrected: false, _suggested: false, _suggestion: null,
        _ocr: { date, txtype, description: desc || '—', paidin, paidout, balance },
        _match: { matched:false, corrected_text:'', category:null, match_type:'none', similarity:0, trust_score:0, overrode_ai:false, entry_id:null }
      })
    }
  }

  return transactions
}

export async function POST(req: NextRequest) {
  try {
    // Auth: use cookie-based ANON client (reads user session), NOT admin
    const authClient = createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised. Please sign in again.' }, { status: 401 })

    // Admin client for DB writes (bypasses RLS)
    const sb = createAdminClient()

    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'File too large. Max 20MB.' }, { status: 400 })

    const { data: mappings } = await sb.from('correction_mappings')
      .select('original_text,corrected_text,category')
      .or(`user_id.eq.${user.id},is_global.eq.true`)

    const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || ''
    if (!rawJson) return NextResponse.json({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON not set in Vercel env vars' }, { status: 500 })

    let creds: any
    try { creds = JSON.parse(rawJson) }
    catch { return NextResponse.json({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON is invalid JSON — re-paste minified JSON in Vercel' }, { status: 500 }) }

    // Repair private_key newlines (Vercel env vars escape them)
    if (creds.private_key) {
      creds.private_key = creds.private_key.replace(/\\n/g, String.fromCharCode(10)).replace(/\n/g, String.fromCharCode(10))
    }

    const location    = (process.env.GOOGLE_LOCATION     || 'eu').toLowerCase().trim()
    const projectId   = (process.env.GOOGLE_PROJECT_ID   || '').trim()
    const processorId = (process.env.GOOGLE_PROCESSOR_ID || '').trim()
    if (!projectId)   return NextResponse.json({ error: 'GOOGLE_PROJECT_ID not set' }, { status: 500 })
    if (!processorId) return NextResponse.json({ error: 'GOOGLE_PROCESSOR_ID not set' }, { status: 500 })

    const auth   = new GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/cloud-platform'] })
    const client = await auth.getClient()
    const token  = await client.getAccessToken()
    if (!token.token) return NextResponse.json({ error: 'Failed to get Google access token' }, { status: 500 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const url    = `https://${location}-documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`

    const gRes = await fetch(url, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${token.token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ rawDocument: { content: buffer.toString('base64'), mimeType: file.type || 'application/pdf' } })
    })

    if (!gRes.ok) {
      const errBody = await gRes.json().catch(() => ({})) as any
      return NextResponse.json({ error: errBody?.error?.message || `Google API error ${gRes.status}` }, { status: 500 })
    }

    const result = await gRes.json()
    const transactions = parseTransactions(result.document, mappings || [])

    void sb.from('rate_limits').insert({
      user_id:    user.id,
      action:     'process_pdf',
      window_key: `${user.id}:pdf:${Math.floor(Date.now() / 3600000)}`
    })

    return NextResponse.json({
      transactions,
      sessionId: crypto.randomUUID(),
      fileName:  file.name,
      stats: { total: transactions.length, autoCorrected: 0, suggested: 0, lowConfidence: 0, errors: 0, warnings: 0, duplicates: 0, redFlags: 0 }
    })

  } catch (err: any) {
    console.error('[process-pdf]', err)
    return NextResponse.json({ error: 'V3-' + (err?.message || 'Unexpected server error') }, { status: 500 })
  }
}
