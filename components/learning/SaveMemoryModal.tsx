'use client'
import { useState } from 'react'
const CATS=['','🛒 Shopping','💡 Utilities','🚗 Transport','🏦 Banking/Loan','📣 Marketing','💼 Payroll','🏛 HMRC / Tax','💼 Dividend','👤 Director Payment','📋 Professional','🛡 Insurance','🏠 Property']
interface Props{open:boolean;raw:string;corrected:string;onClose:()=>void;onSave:(r:string,c:string,cat:string,remember:boolean)=>Promise<void>}
export default function SaveMemoryModal({open,raw,corrected,onClose,onSave}:Props){
  const[corr,setCorr]=useState(corrected)
  const[cat,setCat]=useState('')
  const[remember,setRemember]=useState(true)
  const[saving,setSaving]=useState(false)
  if(!open)return null
  async function handle(){setSaving(true);await onSave(raw,corr,cat,remember);setSaving(false);onClose()}
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold">🧠 Learning Engine</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">OCR Original</p><p className="font-mono text-sm">{raw}</p></div>
          <div><label className="text-sm font-medium block mb-1.5">Corrected description</label><input value={corr} onChange={e=>setCorr(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500"/></div>
          <div><label className="text-sm font-medium block mb-1.5">Category</label>
            <select value={cat} onChange={e=>setCat(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500">
              {CATS.map(c=><option key={c} value={c}>{c||'— Select —'}</option>)}
            </select>
          </div>
          <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-slate-50">
            <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} className="mt-0.5"/>
            <div><p className="text-sm font-medium">Save to my dictionary</p><p className="text-xs text-slate-500">Auto-apply next time same text appears</p></div>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button onClick={handle} disabled={saving} className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">{saving?'Saving…':'Apply'}</button>
        </div>
      </div>
    </div>
  )
}
