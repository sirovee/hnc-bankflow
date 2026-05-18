'use client'
/**
 * hooks/useTransactions.ts
 * Central state machine for the converter page.
 * Handles: load, edit, validate, bulk ops, filter, sort, undo.
 */
import { useState, useCallback, useMemo } from 'react'
import { v4 as uuid } from 'uuid'
import { toast }      from 'sonner'
import type { EnrichedTransaction, ValidationResult, AuditEntry, ReconciliationSummary } from '@/types'
import { safeFloat, cleanNumber, rowId } from '@/lib/utils'

// ── Red flag keywords ─────────────────────────────────────────
const RED_FLAGS = /hmrc|vat|dividend|director|transfer|loan|bounce|unpaid|dishonoured|liquidat|insolvency|court|penalty|fraud|winding|receiver|creditor/i

// ── Validation (prev + in - out = curr) ──────────────────────
function validate(txs: EnrichedTransaction[]): ValidationResult[] {
  const rev = [...txs].reverse()
  const res = new Array<ValidationResult>(txs.length).fill(null as any)

  for (let i = 0; i < rev.length; i++) {
    const ri   = txs.length - 1 - i
    const curr = rev[i]
    const balP = safeFloat(curr.balance)
    const insP = safeFloat(curr.paidin)
    const outP = safeFloat(curr.paidout)
    const pw   = !balP.ok || !insP.ok || !outP.ok

    if (i === 0) {
      res[ri] = { status: !curr.balance ? 'skip' : 'ok', diff: 0, expected: balP.val, balImpossible: false, parseWarn: pw }
      continue
    }

    const prevBal = safeFloat(rev[i - 1].balance)
    if (!prevBal.ok || !curr.balance) {
      res[ri] = { status: 'skip', diff: 0, expected: null, balImpossible: false, parseWarn: pw }
      continue
    }

    const expected = Math.round((prevBal.val + insP.val - outP.val) * 100) / 100
    const diff     = Math.round((balP.val - expected) * 100) / 100
    const abs      = Math.abs(diff)
    const status   = abs <= 0.02 ? 'ok' : abs <= 1.00 ? 'warn' : 'error'
    res[ri] = { status, diff, expected, balImpossible: status !== 'ok', parseWarn: pw }
  }
  return res
}

// ── Duplicate detection ───────────────────────────────────────
function findDuplicates(txs: EnrichedTransaction[]): Set<number> {
  const seen: Record<string, number[]> = {}
  txs.forEach((t, i) => {
    const k = `${t.date}|${(t.description || '').toLowerCase().trim()}|${t.paidin}|${t.paidout}`
    if (!seen[k]) seen[k] = []
    seen[k].push(i)
  })
  const dups = new Set<number>()
  Object.values(seen).forEach(idxs => { if (idxs.length > 1) idxs.forEach(i => dups.add(i)) })
  return dups
}

// ── Reconciliation ────────────────────────────────────────────
function reconcile(txs: EnrichedTransaction[]): ReconciliationSummary | null {
  if (!txs.length) return null
  const oldest  = txs[txs.length - 1]
  const newest  = txs[0]
  const opening = safeFloat(oldest.balance).val
  const totalIn  = txs.reduce((s, t) => s + safeFloat(t.paidin).val, 0)
  const totalOut = txs.reduce((s, t) => s + safeFloat(t.paidout).val, 0)
  const calc    = Math.round((opening + totalIn - totalOut) * 100) / 100
  const actual  = safeFloat(newest.balance).val
  const diff    = Math.round((calc - actual) * 100) / 100
  const abs     = Math.abs(diff)
  return {
    openingBalance:  opening,
    totalIn, totalOut,
    calculatedClose: calc,
    actualClose:     actual,
    diff,
    status: abs <= 0.02 ? 'balanced' : abs <= 1 ? 'warning' : 'error',
  }
}

// ── Main hook ─────────────────────────────────────────────────
export function useTransactions(initial: EnrichedTransaction[] = []) {
  const [rows,     setRows]     = useState<EnrichedTransaction[]>(initial)
  const [audit,    setAudit]    = useState<AuditEntry[]>([])
  const [verified, setVerified] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  // Derive enriched state
  const enriched = useMemo<EnrichedTransaction[]>(() => {
    const dups    = findDuplicates(rows)
    const valRes  = validate(rows)
    return rows.map((t, i) => ({
      ...t,
      _val:         valRes[i] ?? null,
      _isDuplicate: dups.has(i),
      _isRedFlag:   RED_FLAGS.test(t.description || ''),
      _isVerified:  verified.has(i),
      _parseWarn:   valRes[i]?.parseWarn ?? false,
      _selected:    !!selected[t.id],
    }))
  }, [rows, verified, selected])

  const recon = useMemo(() => reconcile(enriched), [enriched])

  // ── CRUD ──────────────────────────────────────────────────
  const editCell = useCallback((idx: number, field: keyof EnrichedTransaction, value: string) => {
    setRows(prev => {
      const next = [...prev]
      const old  = (next[idx] as any)[field] as string
      ;(next[idx] as any)[field] = ['paidin','paidout','balance'].includes(field)
        ? cleanNumber(value).str
        : value
      setAudit(a => [{
        row: idx, field: String(field),
        label: String(field), desc: next[idx].description || `Row ${idx+1}`,
        orig: old || '(empty)', edited: value || '(empty)',
        ts: new Date(), restored: false,
      }, ...a])
      return next
    })
  }, [])

  const addRow = useCallback((idx?: number) => {
    const blank: EnrichedTransaction = {
      id: uuid(), date:'', txtype:'', description:'', paidin:'', paidout:'', balance:'',
      _confidence:null, _page:null, _ocr:{}, category:null,
      _match:{ matched:false, corrected_text:'', category:null, match_type:'none', similarity:0, trust_score:0, overrode_ai:false, entry_id:null },
      _auto_corrected:false, _suggested:false, _suggestion:null,
      _isDuplicate:false, _isRedFlag:false, _isVerified:false, _parseWarn:false, _selected:false, _val:null,
    }
    setRows(prev => {
      const next = [...prev]
      next.splice(idx ?? 0, 0, blank)
      return next
    })
  }, [])

  const deleteRow = useCallback((idx: number) => {
    if (!confirm(`Delete row ${idx+1}: "${rows[idx]?.description || '(empty)'}"?`)) return
    setRows(prev => prev.filter((_, i) => i !== idx))
    toast.success('Row deleted')
  }, [rows])

  const duplicateRow = useCallback((idx: number) => {
    setRows(prev => {
      const next  = [...prev]
      const clone = { ...next[idx], id: uuid() }
      next.splice(idx, 0, clone)
      return next
    })
  }, [])

  const moveAmount = useCallback((idx: number, dir: 'toIn' | 'toOut') => {
    setRows(prev => {
      const next = [...prev]
      const t    = { ...next[idx] }
      if (dir === 'toIn')  { t.paidin = t.paidout; t.paidout = '' }
      else                  { t.paidout = t.paidin; t.paidin = '' }
      next[idx] = t
      return next
    })
  }, [])

  // ── Restore from audit ─────────────────────────────────────
  const restoreEdit = useCallback((auditIdx: number) => {
    const entry = audit[auditIdx]
    if (!entry) return
    if (!confirm(`Restore row ${entry.row+1} · ${entry.label} back to "${entry.orig}"?`)) return
    setRows(prev => {
      const next = [...prev]
      ;(next[entry.row] as any)[entry.field] = entry.orig === '(empty)' ? '' : entry.orig
      return next
    })
    setAudit(a => a.filter((_, i) => i !== auditIdx))
    toast.success('Edit restored')
  }, [audit])

  // ── Bulk actions ───────────────────────────────────────────
  const selectedIndices = useMemo(
    () => enriched.map((t,i) => t._selected ? i : -1).filter(i => i >= 0),
    [enriched]
  )

  const bulkDelete = useCallback(() => {
    if (!selectedIndices.length) return
    if (!confirm(`Delete ${selectedIndices.length} rows?`)) return
    setRows(prev => prev.filter((_, i) => !selectedIndices.includes(i)))
    setSelected({})
    toast.success(`${selectedIndices.length} rows deleted`)
  }, [selectedIndices])

  const bulkVerify = useCallback(() => {
    setVerified(v => { const n = new Set(v); selectedIndices.forEach(i => n.add(i)); return n })
    setSelected({})
    toast.success(`${selectedIndices.length} rows verified`)
  }, [selectedIndices])

  const bulkUnverify = useCallback(() => {
    setVerified(v => { const n = new Set(v); selectedIndices.forEach(i => n.delete(i)); return n })
    setSelected({})
  }, [selectedIndices])

  const toggleSelect = useCallback((id: string, checked: boolean) => {
    setSelected(s => ({ ...s, [id]: checked }))
  }, [])

  const toggleSelectAll = useCallback((checked: boolean) => {
    setSelected(checked ? Object.fromEntries(enriched.map(t => [t.id, true])) : {})
  }, [enriched])

  // ── Load (replace all) ─────────────────────────────────────
  const loadTransactions = useCallback((txs: EnrichedTransaction[]) => {
    setRows(txs)
    setAudit([])
    setVerified(new Set())
    setSelected({})
  }, [])

  return {
    rows: enriched,
    audit,
    recon,
    selectedIndices,
    selectedCount: selectedIndices.length,
    stats: useMemo(() => ({
      total:         enriched.length,
      autoCorrected: enriched.filter(t => t._auto_corrected).length,
      suggested:     enriched.filter(t => t._suggested).length,
      lowConfidence: enriched.filter(t => t._confidence !== null && t._confidence < 0.8).length,
      errors:        enriched.filter(t => t._val?.status === 'error').length,
      warnings:      enriched.filter(t => t._val?.status === 'warn').length,
      duplicates:    enriched.filter(t => t._isDuplicate).length,
      redFlags:      enriched.filter(t => t._isRedFlag).length,
    }), [enriched]),
    // Actions
    editCell, addRow, deleteRow, duplicateRow, moveAmount,
    restoreEdit, loadTransactions,
    bulkDelete, bulkVerify, bulkUnverify,
    toggleSelect, toggleSelectAll,
  }
}
