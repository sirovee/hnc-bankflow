'use client'
import { useEffect, useState } from 'react'
interface Entry{id:string;created_at:string;file_name:string;row_index:number;field_name:string;original_val:string;edited_val:string;restored:boolean}
export default function AuditPage(){
  const[entries,setEntries]=useState<Entry[]>([])
  const[loading,setLoading]=useState(true)
  useEffect(()=>{fetch('/api/audit').then(r=>r.json()).then(d=>{setEntries(d.entries||[]);setLoading(false)})}, [])
  function exportCsv(){
    const rows=[['Time','File','Row','Field','Original','Edited'],...entries.map(e=>[e.created_at,e.file_name,e.row_index+1,e.field_name,e.original_val,e.edited_val])]
    const csv=rows.map(r=>r.map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n')
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='audit-log.csv';a.click()
  }
  return(
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-semibold">Audit Trail</h2><p className="text-sm" style={{color:'#64748b'}}>Permanent record of every edit — court-admissible</p></div>
        <button onClick={exportCsv} disabled={!entries.length} className="px-3 py-1.5 border border-border rounded-md text-sm hover:bg-muted disabled:opacity-40">⬇ Export CSV</button>
      </div>
      <div className="rounded-xl border border-border bg-background overflow-hidden">
        {loading?<div className="py-16 text-center text-sm" style={{color:'#94a3b8'}}>Loading…</div>:
        entries.length===0?<div className="py-16 text-center text-sm" style={{color:'#94a3b8'}}>No edits recorded yet. Process a statement to start the audit trail.</div>:
        <table className="w-full border-collapse text-sm">
          <thead><tr style={{background:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>
            {['Time','File','Row','Field','Original','Edited To','Status'].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{color:'#64748b'}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {entries.map(e=>(
              <tr key={e.id} className="border-b border-border hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-xs font-mono whitespace-nowrap" style={{color:'#94a3b8'}}>{new Date(e.created_at).toLocaleString('en-GB')}</td>
                <td className="px-4 py-3 text-xs max-w-[120px] truncate">{e.file_name}</td>
                <td className="px-4 py-3 text-center text-xs font-semibold">{e.row_index+1}</td>
                <td className="px-4 py-3"><span className="rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600">{e.field_name}</span></td>
                <td className="px-4 py-3"><span className="font-mono text-xs px-1.5 py-0.5 rounded line-through" style={{background:'#fef2f2',color:'#dc2626'}}>{e.original_val||'(empty)'}</span></td>
                <td className="px-4 py-3"><span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{background:'#f0fdf4',color:'#16a34a'}}>{e.edited_val||'(empty)'}</span></td>
                <td className="px-4 py-3 text-xs" style={{color:e.restored?'#d97706':'#94a3b8'}}>{e.restored?'↩ Restored':'Edited'}</td>
              </tr>
            ))}
          </tbody>
        </table>}
      </div>
    </div>
  )
}
