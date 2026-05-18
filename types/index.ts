// types/index.ts — Single source of truth for all interfaces

export interface UserProfile {
  id:           string
  email:        string
  full_name:    string | null
  company_name: string | null
  logo_url:     string | null
  plan:         'free' | 'pro' | 'enterprise'
  pages_used:   number
  pages_limit:  number
}

export interface RawTransaction {
  date:        string
  txtype:      string
  description: string
  paidin:      string
  paidout:     string
  balance:     string
  _confidence: number | null
  _page:       number | null
  _ocr:        Partial<Omit<RawTransaction, '_ocr'>>
}

export interface ValidationResult {
  status:        'ok' | 'warn' | 'error' | 'skip'
  diff:          number
  expected:      number | null
  balImpossible: boolean
  parseWarn:     boolean
}

export interface MatchResult {
  matched:        boolean
  corrected_text: string
  category:       string | null
  match_type:     'exact' | 'fuzzy' | 'none'
  similarity:     number
  trust_score:    number
  overrode_ai:    boolean
  entry_id:       string | null
}

export interface EnrichedTransaction extends RawTransaction {
  id:              string          // stable row ID for TanStack Table
  category:        string | null
  _val:            ValidationResult | null
  _match:          MatchResult
  _auto_corrected: boolean
  _suggested:      boolean
  _suggestion:     string | null
  _isDuplicate:    boolean
  _isRedFlag:      boolean
  _isVerified:     boolean
  _parseWarn:      boolean
  _selected:       boolean
}

export interface DictionaryEntry {
  id:                  string
  user_id:             string | null
  original_text:       string
  corrected_text:      string
  category:            string | null
  trust_score:         number
  hit_count:           number
  unique_user_count:   number
  is_global:           boolean
  confidence_override: number
  created_at:          string
}

export interface AuditEntry {
  id?:        string
  row:        number
  field:      string
  label:      string
  desc:       string
  orig:       string
  edited:     string
  ts:         Date
  restored:   boolean
  session_id?: string
}

export interface ReconciliationSummary {
  openingBalance:  number
  totalIn:         number
  totalOut:        number
  calculatedClose: number
  actualClose:     number
  diff:            number
  status:          'balanced' | 'warning' | 'error'
}

export interface ProcessingStats {
  total:         number
  autoCorrected: number
  suggested:     number
  lowConfidence: number
  errors:        number
  warnings:      number
  duplicates:    number
  redFlags:      number
}

export interface ProcessPdfResponse {
  transactions: EnrichedTransaction[]
  sessionId:    string
  fileName:     string
  pageCount:    number
  rawText:      string
  stats:        ProcessingStats
}

export interface LearnPayload {
  raw_text:       string
  corrected_text: string
  category?:      string
  remember:       boolean
  session_id:     string
  row_index:      number
}

export interface RateLimitResult {
  allowed:   boolean
  remaining: number
  resetAt:   Date
  limit:     number
}

export type JobStatus = 'pending' | 'processing' | 'done' | 'failed'

export interface ProcessingJob {
  id:         string
  status:     JobStatus
  progress:   number
  message:    string
  result?:    ProcessPdfResponse
  error?:     string
}
