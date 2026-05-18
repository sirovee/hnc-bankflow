'use client'
import { useEffect, useState } from 'react'
import { Clock, RotateCcw, Download } from 'lucide-react'
import { Button }   from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge }    from '@/components/ui/badge'

interface Entry {
  id: string; created_at: string; file_name: string
  row_index: number; field_name: string; original_val: string
  edited_val: string; restored: boolean
}

export default function AuditPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/audit').then(r=>r.json()).then(d => {
      setEntries(d.entries || [])
      setLoading(false)
    })
  }, [])

  function exportCsv() {
    const rows = [
      ['Time','File','Row','Field','Original','Edited','Restored'],
      ...entries.map(e => [e.created_at, e.file_name, e.row_index+1, e.field_name, e.original_val, e.edited_val, e.restored?'YES':'NO'])
    ]
    const csv = rows.map(r=>r.map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='audit-log.csv'; a.click()
  }

  const FIELD_LABELS: Record<string,string> = { date:'Date', txtype:'Type', description:'Description', paidin:'Paid In', paidout:'Paid Out', balance:'Balance' }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Audit Trail</h2>
          <p className="text-sm text-muted-foreground">Permanent record of every edit made to your statements</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!entries.length}>
          <Download className="h-4 w-4"/> Export CSV
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              {['Time','File','Row','Field','Original','Edited to','Status'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && Array.from({length:8}).map((_,i) => (
              <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-4"/></td></tr>
            ))}
            {!loading && !entries.length && (
              <tr><td colSpan={7} className="py-16 text-center text-sm text-muted-foreground">
                <Clock className="mx-auto mb-2 h-8 w-8 opacity-20"/>
                No edits recorded yet. Process a statement to start the audit trail.
              </td></tr>
            )}
            {!loading && entries.map(e => (
              <tr key={e.id} className={`hover:bg-muted/30 transition-colors ${e.restored?'opacity-60':''}`}>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(e.created_at).toLocaleString('en-GB')}</td>
                <td className="px-4 py-3 text-xs max-w-[140px] truncate" title={e.file_name}>{e.file_name}</td>
                <td className="px-4 py-3 text-xs text-center">{e.row_index+1}</td>
                <td className="px-4 py-3"><Badge variant="secondary" className="text-xs">{FIELD_LABELS[e.field_name]||e.field_name}</Badge></td>
                <td className="px-4 py-3 font-mono text-xs text-red-600 line-through max-w-[140px] truncate" title={e.original_val}>{e.original_val||'(empty)'}</td>
                <td className="px-4 py-3 font-mono text-xs text-green-700 max-w-[140px] truncate" title={e.edited_val}>{e.edited_val||'(empty)'}</td>
                <td className="px-4 py-3">
                  {e.restored
                    ? <span className="flex items-center gap-1 text-xs text-amber-600"><RotateCcw className="h-3 w-3"/>Restored</span>
                    : <span className="text-xs text-muted-foreground">Edited</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
