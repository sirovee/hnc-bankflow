'use client'
/**
 * app/(app)/converter/page.tsx
 * The core converter page — upload, process, edit, export.
 */
import { useState, useCallback, useRef }  from 'react'
import { toast }                           from 'sonner'
import { useTransactions }                 from '@/hooks/useTransactions'
import TransactionTable                    from '@/components/table/TransactionTable'
import UploadZone                          from '@/components/converter/UploadZone'
import StatCards                           from '@/components/converter/StatCards'
import ReconciliationBar                   from '@/components/converter/ReconciliationBar'
import FilterBar                           from '@/components/converter/FilterBar'
import BulkActionBar                       from '@/components/converter/BulkActionBar'
import PdfViewer                           from '@/components/pdf/PdfViewer'
import SaveMemoryModal                     from '@/components/learning/SaveMemoryModal'
import { Button }                          from '@/components/ui/button'
import { Progress }                        from '@/components/ui/progress'
import type { EnrichedTransaction, ProcessPdfResponse } from '@/types'
import {
  Download, Plus, FileText, PanelRightOpen,
  PanelRightClose, Loader2
} from 'lucide-react'
import * as XLSX from 'xlsx'

interface ProcessingState {
  active:   boolean
  progress: number
  message:  string
}

interface FilterState {
  query:     string
  minAmt:    string
  maxAmt:    string
  txtype:    string
  status:    string
}

export default function ConverterPage() {
  const txStore = useTransactions()

  const [proc,     setProc]     = useState<ProcessingState>({ active:false, progress:0, message:'' })
  const [pdfFile,  setPdfFile]  = useState<File | null>(null)
  const [showPdf,  setShowPdf]  = useState(false)
  const [session,  setSession]  = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [filter,   setFilter]   = useState<FilterState>({ query:'', minAmt:'', maxAmt:'', txtype:'', status:'' })
  const [learnModal, setLearnModal] = useState<{ open:boolean; idx:number; raw:string; corrected:string }>({
    open:false, idx:0, raw:'', corrected:''
  })
  const [rowSelection, setRowSelection] = useState({})

  // ── Process uploaded PDF ────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    setPdfFile(file)
    setFileName(file.name)
    setProc({ active:true, progress:10, message:'Reading file...' })

    const form = new FormData()
    form.append('file', file)

    try {
      setProc({ active:true, progress:30, message:'Sending to Document AI...' })
      const res  = await fetch('/api/process-pdf', { method:'POST', body:form })
      const data: ProcessPdfResponse & { error?: string } = await res.json()

      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)

      setProc({ active:true, progress:80, message:'Applying learning engine...' })
      await new Promise(r => setTimeout(r, 100)) // yield

      txStore.loadTransactions(data.transactions)
      setSession(data.sessionId)
      setShowPdf(true)

      setProc({ active:true, progress:100, message:'Done!' })
      setTimeout(() => setProc({ active:false, progress:0, message:'' }), 800)

      toast.success(`Loaded ${data.transactions.length} transactions`, {
        description: `${data.stats.autoCorrected} auto-corrected · ${data.stats.errors} validation errors`,
      })
    } catch (err: any) {
      setProc({ active:false, progress:0, message:'' })
      toast.error(err.message || 'Processing failed')
    }
  }, [txStore])

  // ── Filtered rows ───────────────────────────────────────────
  const filteredRows = txStore.rows.filter(t => {
    const q   = filter.query.toLowerCase()
    const amt = parseFloat(t.paidin || t.paidout || '0')
    if (q && !`${t.date} ${t.txtype} ${t.description} ${t.paidin} ${t.paidout}`.toLowerCase().includes(q)) return false
    if (filter.minAmt && amt < parseFloat(filter.minAmt)) return false
    if (filter.maxAmt && amt > parseFloat(filter.maxAmt)) return false
    if (filter.txtype && t.txtype !== filter.txtype)      return false
    if (filter.status === 'error'   && t._val?.status !== 'error')  return false
    if (filter.status === 'warn'    && t._val?.status !== 'warn')   return false
    if (filter.status === 'dup'     && !t._isDuplicate)              return false
    if (filter.status === 'redflag' && !t._isRedFlag)                return false
    if (filter.status === 'verified'&& !t._isVerified)               return false
    return true
  })

  // ── Excel export ────────────────────────────────────────────
  function exportExcel() {
    if (!txStore.rows.length) { toast.error('No data to export'); return }

    const header = ['Date','Type','Description','Paid In','Paid Out','Balance','Validation','Diff (£)','Category','Auto-Corrected']
    const dataRows = txStore.rows.map(t => [
      t.date, t.txtype, t.description,
      t.paidin  ? parseFloat(t.paidin)  : '',
      t.paidout ? parseFloat(t.paidout) : '',
      t.balance ? parseFloat(t.balance) : '',
      t._val?.status || '',
      t._val?.diff != null ? parseFloat(t._val.diff.toFixed(2)) : '',
      t.category || '',
      t._auto_corrected ? 'YES' : 'NO',
    ])

    const ws1 = XLSX.utils.aoa_to_sheet([header, ...dataRows])
    ws1['!cols'] = [{wch:14},{wch:7},{wch:45},{wch:13},{wch:13},{wch:13},{wch:11},{wch:10},{wch:18},{wch:14}]

    // Audit trail sheet
    const ah  = ['Time','Row','Field','Original','Edited','Restored']
    const aRows = txStore.audit.map(e => [
      e.ts.toLocaleString(), e.row+1, e.label, e.orig, e.edited, e.restored ? 'YES' : 'NO'
    ])
    const ws2 = XLSX.utils.aoa_to_sheet(aRows.length ? [ah,...aRows] : [ah, ['No edits','']])
    ws2['!cols'] = [{wch:20},{wch:6},{wch:14},{wch:30},{wch:30},{wch:10}]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws1, 'Transactions')
    XLSX.utils.book_append_sheet(wb, ws2, 'Audit Trail')
    XLSX.writeFile(wb, `${fileName.replace(/\.pdf$/i,'') || 'bank-statement'}.xlsx`)
    toast.success('Excel exported with audit trail')
  }

  function exportCsv() {
    if (!txStore.rows.length) { toast.error('No data to export'); return }
    const header = ['Date','Type','Description','Paid In','Paid Out','Balance','Validation']
    const rows   = txStore.rows.map(t =>
      [t.date, t.txtype, t.description,
       t.paidin?'£'+t.paidin:'', t.paidout?'£'+t.paidout:'', t.balance?'£'+t.balance:'',
       t._val?.status||'']
    )
    const csv = [header,...rows].map(r => r.map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}))
    a.download = `${fileName.replace(/\.pdf$/i,'') || 'bank-statement'}.csv`
    a.click()
  }

  return (
    <div className="flex h-full flex-col gap-4">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Statement Converter</h2>
          <p className="text-sm text-muted-foreground">
            {fileName ? `Processing: ${fileName}` : 'Upload a bank statement to begin'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {txStore.rows.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={() => txStore.addRow()}>
                <Plus className="h-4 w-4" /> Add Row
              </Button>
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download className="h-4 w-4" /> CSV
              </Button>
              <Button size="sm" onClick={exportExcel}>
                <Download className="h-4 w-4" /> Excel
              </Button>
              {pdfFile && (
                <Button variant="ghost" size="sm" onClick={() => setShowPdf(s => !s)}>
                  {showPdf ? <PanelRightClose className="h-4 w-4"/> : <PanelRightOpen className="h-4 w-4"/>}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Processing bar */}
      {proc.active && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm font-medium text-primary">{proc.message}</span>
          <Progress value={proc.progress} className="flex-1" />
          <span className="text-xs font-semibold text-primary">{proc.progress}%</span>
        </div>
      )}

      {/* Upload zone (shown when no data) */}
      {!txStore.rows.length && !proc.active && (
        <UploadZone onFile={handleFile} />
      )}

      {/* Main content */}
      {txStore.rows.length > 0 && (
        <>
          {/* Stat cards */}
          <StatCards stats={txStore.stats} recon={txStore.recon} />

          {/* Reconciliation bar */}
          {txStore.recon && <ReconciliationBar recon={txStore.recon} />}

          {/* Split view: table + PDF */}
          <div className={`flex gap-4 flex-1 min-h-0 ${showPdf ? 'flex-row' : 'flex-col'}`}>

            {/* Table panel */}
            <div className="flex flex-col flex-1 min-w-0 rounded-xl border border-border bg-background">
              <FilterBar
                filter={filter}
                onChange={setFilter}
                totalCount={txStore.rows.length}
                filteredCount={filteredRows.length}
              />
              <BulkActionBar
                count={txStore.selectedCount}
                onDelete={txStore.bulkDelete}
                onVerify={txStore.bulkVerify}
                onUnverify={txStore.bulkUnverify}
                onDeselect={() => txStore.toggleSelectAll(false)}
              />
              <TransactionTable
                data={filteredRows}
                onCellEdit={(i, f, v) => {
                  const realIdx = txStore.rows.findIndex(r => r.id === filteredRows[i]?.id)
                  if (realIdx >= 0) txStore.editCell(realIdx, f, v)
                }}
                onMoveAmount={(i, d) => {
                  const realIdx = txStore.rows.findIndex(r => r.id === filteredRows[i]?.id)
                  if (realIdx >= 0) txStore.moveAmount(realIdx, d)
                }}
                onInsertRow={(i, p) => txStore.addRow(p === 'above' ? i : i + 1)}
                onDuplicateRow={i => txStore.duplicateRow(i)}
                onDeleteRow={i => {
                  const realIdx = txStore.rows.findIndex(r => r.id === filteredRows[i]?.id)
                  if (realIdx >= 0) txStore.deleteRow(realIdx)
                }}
                onLearn={(i, raw, corrected) => setLearnModal({ open:true, idx:i, raw, corrected })}
                selectedRows={rowSelection}
                onSelectionChange={setRowSelection}
              />
            </div>

            {/* PDF panel */}
            {showPdf && pdfFile && (
              <div className="w-[420px] shrink-0">
                <PdfViewer file={pdfFile} />
              </div>
            )}
          </div>
        </>
      )}

      {/* Save to Memory modal */}
      <SaveMemoryModal
        open={learnModal.open}
        raw={learnModal.raw}
        corrected={learnModal.corrected}
        onClose={() => setLearnModal(s => ({...s, open:false}))}
        onSave={async (raw, corrected, category, remember) => {
          if (!remember) return
          await fetch('/api/learn', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ raw_text:raw, corrected_text:corrected, category, remember, session_id:session||'', row_index:learnModal.idx }),
          })
          toast.success('Correction saved to your dictionary 🧠')
        }}
      />
    </div>
  )
}
