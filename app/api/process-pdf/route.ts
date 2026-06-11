import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleAuth } from 'google-auth-library'

export const runtime = 'nodejs'
export const maxDuration = 60

// Safely escape special regex characters (like *, +, ?) inside text entries
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseTransactions(document: any, mappings: any[]): any[] {
  const rawText = document?.text || ''
  const transactions: any[] = []
  const corrMap: Record<string, string> = {}
  
  for (const m of (mappings || [])) {
    if (m.original_text) {
      corrMap[m.original_text.toUpperCase()] = m.corrected_text
    }
  }

  function fix(text: string): string {
    if (!text) return text
    let updatedText = text;
    for (const [k, v] of Object.entries(corrMap)) {
      if (updatedText.toUpperCase().includes(k)) {
        const safePattern = escapeRegExp(k);
        updatedText = updatedText.replace(new RegExp(safePattern, 'gi'), v);
      }
    }
    return updatedText
  }

  if (!rawText) return []
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
    
    let desc = full.replace(dateRx,'').replace(typeRx,'')
      .replace(/£?\d{1,3}(?:,\d{3})*\.\d{2}/g,'').replace(/\s+/g,' ').trim()
    
    desc = fix(desc)
    let paidin = '', paidout = '', balance = ''
    
    if (amounts.length >= 2) {
      balance = amounts[amounts.length - 1]
      const a = amounts[amounts.length - 2]
      if (/from|receipt|deposit|refund/i.test(desc) || ['POC','BAC'].includes(txtype)) paidin = a
      else if (['CHG','D/D','S/O','SBT','POS'].includes(txtype) || /to a\/c/i.test(desc)) paidout = a
      else paidin = a
    } else if (amounts.length === 1) {
      balance = amounts[0]
    }
    
    if (date) {
      transactions.push({
        id: crypto.randomUUID().slice(0, 8),
        date, 
        txtype, 
        description: desc || '—', 
        paidin, 
        paidout, 
        balance,
        _confidence: null, 
        _page: null, 
        _auto_corrected: false, 
        _suggested: false, 
        _suggestion: null,
        _ocr: { date, txtype, description: desc || '—', paidin, paidout, balance },
        _match: { matched: false, corrected_text: '', category: null, match_type: 'none', similarity: 0, trust_score: 0, overrode_ai: false, entry_id: null }
      })
    }
    i = j
  }
  return transactions
}

export async function POST(req: NextRequest) {
  try {
    // 1. Direct Supabase configuration initialization (No Next.js middleware cookie interference)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Supabase configuration environment variables are missing.' }, { status: 500 })
    }
    
    const sb = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    // 2. Authenticate using incoming request token validation
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorised — Missing Authorization token headers' }, { status: 401 })
    
    const tokenStr = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await sb.auth.getUser(tokenStr)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorised access profile' }, { status: 401 })

    // 3. Form handling constraints
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'File too large. Max 20MB.' }, { status: 400 })

    // 4. Fetch structural map dependencies
    const { data: mappings } = await sb.from('correction_mappings')
      .select('original_text,corrected_text,category')
      .or(`user_id.eq.${user.id},is_global.eq.true`)

    // 5. Cloud Platform Credentials setup
    const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || ''
    if (!rawJson) return NextResponse.json({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON not set in Vercel env vars' }, { status: 500 })

    let creds: any
    try { creds = JSON.parse(rawJson) }
    catch { return NextResponse.json({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON runtime parsing failed' }, { status: 500 }) }

    const location    = (process.env.GOOGLE_LOCATION     || 'eu').toLowerCase().trim()
    const projectId   = (process.env.GOOGLE_PROJECT_ID   || '').trim()
    const processorId = (process.env.GOOGLE_PROCESSOR_ID || '').trim()
    
    if (!projectId || !processorId) {
      return NextResponse.json({ error: 'Google configuration platform parameters are missing' }, { status: 500 })
    }

    const auth   = new GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/cloud-platform'] })
    const client = await auth.getClient()
    const token  = await client.getAccessToken()
    if (!token.token) return NextResponse.json({ error: 'Failed to retrieve cloud access scopes' }, { status: 500 })

    // 6. Execution request pipeline payload construction
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

    // Log operational usage safely
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
    console.error('[process-pdf-error-log]', err)
    return NextResponse.json({ error: err?.message || 'Internal pipeline processing fault occurred' }, { status: 500 })
  }
}