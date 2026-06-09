'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
interface Entry{id:string;original_text:string;corrected_text:string;category:string|null;trust_score:number;hit_count:number;is_global:boolean}
export default function DictionaryPage(){
  const[entries,setEntries]=useState<Entry[]>([])
  const[loading,setLoading]=useState(true)
  const[query,setQuery]=useState('')
  const[tab,setTab]=useState<'mine'|'global'>('mine')
  useEffect(()=>{fetch('/api/dict').then(r=>r.json()).then(d=>{setEntries(d.mappings||[]);setLoading(false)})}, [])
  async function del(id:string){
    if(!confirm('Delete this mapping?'))return
    await fetch(`/api/dict?id=${id}`,{method:'DELETE'})
    toast.success('Deleted');setEntries(e=>e.filter(x=>x.id!==id))
  }
  const filtered=entries.filter(e=>tab==='global'?e.is_global:!e.is_global).filter(e=>!query||`${e.original_text} ${e.corrected_text}`.toLowerCase().includes(query.toLowerCase()))
  return(
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-semibold">Smart Dictionary</h2><p className="text-sm" style={{color:'#64748b'}}>{entries.filter(e=>!e.is_global).length} personal · {entries.filter(e=>e.is_global).length} global</p></div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex rounded-lg border p-0.5 bg-slate-50">
          {(['mine','global'] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)} className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition ${tab===t?'bg-white shadow-sm text-slate-900':'text-slate-500 hover:text-slate-700'}`}>
              {t==='mine'?'👤 My Dictionary':'🌐 Global'}
            </button>
          ))}
        </div>
        <input placeholder="🔍 Search…" value={query} onChange={e=>setQuery(e.target.value)} className="rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 w-60"/>
      </div>
      <div className="rounded-xl border border-border bg-background overflow-hidden">
        {loading?<div className="py-16 text-center text-sm" style={{color:'#94a3b8'}}>Loading…</div>:
        filtered.length===0?<div className="py-16 text-center text-sm" style={{color:'#94a3b8'}}>No mappings yet. Edit a cell and save to memory!</div>:
        <table className="w-full border-collapse text-sm">
          <thead><tr style={{background:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>
            {['OCR Original','Corrected To','Category','Trust','Used',''].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{color:'#64748b'}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map(e=>(
              <tr key={e.id} className="border-b border-border hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs" style={{color:'#64748b'}}>{e.original_text}</td>
                <td className="px-4 py-3 font-medium">{e.corrected_text}</td>
                <td className="px-4 py-3 text-xs">{e.category||<span style={{color:'#94a3b8'}}>—</span>}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{width:`${e.trust_score}%`,background:e.trust_score>=80?'#16a34a':e.trust_score>=50?'#d97706':'#94a3b8'}}/></div>
                    <span className="text-xs" style={{color:'#64748b'}}>{e.trust_score}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs" style={{color:'#64748b'}}>{e.hit_count}×</td>
                <td className="px-4 py-3">{!e.is_global&&<button onClick={()=>del(e.id)} className="rounded p-1 transition hover:text-red-600" style={{color:'#94a3b8'}}>🗑</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>}
      </div>
    </div>
  )
}
