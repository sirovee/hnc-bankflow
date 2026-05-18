import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }             from '@/lib/supabase/server'
import { DocumentProcessorServiceClient } from '@google-cloud/documentai'
import { v4 as uuid }                    from 'uuid'

function getDocAIClient() {
  const creds    = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!)
  const location = process.env.GOOGLE_LOCATION || 'eu'
  return new DocumentProcessorServiceClient({
    credentials: creds,
    apiEndpoint: `${location}-documentai.googleapis.com`,
  })
}

const FRIENDLY_ERRORS: Record<number, string> = {
  400: 'The document could not be processed — it may be corrupted or password-protected.',
  401: '🔑 Authentication failed. Check your service account JSON.',
  403: '🔒 Permission denied. Ensure Document AI API is enabled and your service account has the "Document AI API User" role.',
  404: '❌ Processor not found. Check your Project ID, Processor ID and Region.',
  429: '⏱ Rate limit exceeded. Please wait a moment and try again.',
  500: '☁️ Google Cloud error. Please try again shortly.',
}

export async function POST(req: NextRequest) {
  const sb = createAdminClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Rate limit: 10 PDFs/hour
  const now   = new Date()
  const since = new Date(now.getTime() - 60 * 60_000)
  const { count } = await sb.from('rate_limits').select('*', { count:'exact', head:true })
    .eq('user_id', user.id).eq('action','process_pdf').gte('created_at', since.toISOString())
  if ((count||0) >= 10)
    return NextResponse.json({ error: 'Rate limit: 10 PDFs per hour. Please wait.' }, { status: 429 })

  // Parse file
  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const allowed = ['application/pdf','image/png','image/jpeg','image/tiff']
  if (!allowed.includes(file.type))
    return NextResponse.json({ error: `Unsupported type: ${file.type}` }, { status: 400 })
  if (file.size > 20 * 1024 * 1024)
    return NextResponse.json({ error: 'File too large. Max 20MB.' }, { status: 400 })

  let buffer = Buffer.from(await file.arrayBuffer())

  // Fetch user dictionary for auto-correction
  const { data: mappings } = await sb.from('correction_mappings')
    .select('original_text, corrected_text, category, trust_score')
    .or(`user_id.eq.${user.id},is_global.eq.true`)

  let result: any
  try {
    const client  = getDocAIClient()
    const name    = `projects/${process.env.GOOGLE_PROJECT_ID}/locations/${process.env.GOOGLE_LOCATION||'eu'}/processors/${process.env.GOOGLE_PROCESSOR_ID}`
    const [res]   = await client.processDocument({ name, rawDocument: { content: buffer.toString('base64'), mimeType: file.type } })
    result = res
  } catch (err: any) {
    const code = err?.code || err?.status || 500
    return NextResponse.json({ error: FRIENDLY_ERRORS[code] || err.message }, { status: 500 })
  } finally {
    buffer.fill(0) // GDPR: clear from memory
  }

  // Record rate limit
  await sb.from('rate_limits').insert({ user_id: user.id, action:'process_pdf',
    window_key: `${user.id}:pdf:${Math.floor(now.getTime()/3_600_000)}` })

  const sessionId = uuid()
  return NextResponse.json({ document: result.document, sessionId, mappings: mappings||[], fileName: file.name })
}
