// lib/utils/index.ts — Core utilities

import { clsx, type ClassValue } from 'clsx'
import { twMerge }               from 'tailwind-merge'

// ── Tailwind class merger ─────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Priority 3: cleanNumber — handles ALL OCR number formats ──
// Handles: £1,234.56 | 1.234,56 (EU) | (1200.00) negatives | "1 234.50"
export function cleanNumber(raw: string | null | undefined): { str: string; num: number; ok: boolean } {
  if (raw === null || raw === undefined || raw === '') return { str: '', num: 0, ok: true }

  let s = String(raw).trim()

  // Strip currency symbols and whitespace
  s = s.replace(/[£$€¥₹\s]/g, '')

  // Handle accounting negatives: (1200.00) → -1200.00
  const negative = s.startsWith('(') && s.endsWith(')')
  if (negative) s = '-' + s.slice(1, -1)

  // Detect European format: 1.234,56 (dot=thousands, comma=decimal)
  if (/^-?\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    // Standard: strip thousands commas, keep decimal point
    s = s.replace(/,(?=\d{3}(\.|$))/g, '')
    s = s.replace(',', '.') // any remaining comma = decimal separator
  }

  const num = parseFloat(s)
  if (isNaN(num)) return { str: '', num: 0, ok: false }

  return { str: num.toFixed(2), num, ok: true }
}

// ── Safe float ────────────────────────────────────────────────
export function safeFloat(raw: string | null | undefined): { val: number; ok: boolean } {
  const { num, ok } = cleanNumber(raw)
  return { val: ok ? num : 0, ok }
}

// ── Currency formatter ────────────────────────────────────────
export function formatGBP(amount: number | string): string {
  const { num, ok } = cleanNumber(String(amount))
  if (!ok) return '—'
  return new Intl.NumberFormat('en-GB', {
    style:    'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(num)
}

// ── Date normaliser ───────────────────────────────────────────
const MONTHS: Record<string, string> = {
  jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
  jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',
  january:'01',february:'02',march:'03',april:'04',june:'06',
  july:'07',august:'08',september:'09',october:'10',november:'11',december:'12',
}

export function normaliseDate(raw: string): string {
  if (!raw) return raw
  const s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // DD Mon YYYY
  const m1 = s.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/)
  if (m1) {
    const mon = MONTHS[m1[2].toLowerCase()]
    if (mon) return `${m1[3]}-${mon}-${m1[1].padStart(2, '0')}`
  }
  // DD/MM/YYYY or DD.MM.YYYY
  const m2 = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/)
  if (m2) {
    const yr = m2[3].length === 2 ? '20' + m2[3] : m2[3]
    return `${yr}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}`
  }
  return s
}

// ── Stable row ID ─────────────────────────────────────────────
export function rowId(date: string, desc: string, amount: string, idx: number): string {
  return `${date}-${desc.slice(0,10)}-${amount}-${idx}`.replace(/\s+/g, '_')
}
