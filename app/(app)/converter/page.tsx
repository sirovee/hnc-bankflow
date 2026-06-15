'use client'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useTransactions } from '@/hooks/useTransactions'
import PdfViewer from '@/components/pdf/PdfViewer'
import SaveMemoryModal from '@/components/learning/SaveMemoryModal'
import type { ProcessPdfResponse } from '@/types'
import * as XLSX from 'xlsx'

export default function ConverterPage(){
  const tx=useTransactions()
  const[proc,setProc]=useState({active:false,progress:0,msg:''})
  const[pdfFile,setPdf]=useState<File|null>(null)
  const[fileName,setFn]=useState('')
  const[showPdf,setShowPdf]=useState(false)
  const[session,setSession]=useState('')
  const[learn,setLearn]=useState({open:false,idx:0,raw:'',corrected:''})
  const[filter,setFilter]=useState('')

  const handleFile=useCallback(async(file:File)=>{
    setPdf(file);setFn(file.name)
    setProc({active:true,progress:20,msg:'Sending to Document AI…'})
    const form=new FormData();form.append('file',file)
    try{
      const res=await fetch('/api/process-pdf',{method:'POST',body:form})
      const data:ProcessPdfResponse&{error?:string}=await res.json()
      if(!res.ok)throw new Error(data.error||`Error ${res.status}`)
      setProc({active:true,progress:90,msg:'Applying learning engine…'})
      tx.loadTransactions(data.transactions)
      setSession(data.sessionId||'')
      setShowPdf(true)
      setProc({active:true,progress:100,msg:'Done!'})
      setTimeout(()=>setProc({active:false,progress:0,msg:''}),800)
      toast.success(`Loaded ${data.transactions.length} transactions`)
    }catch(e:any){setProc({active:false,progress:0,msg:''});toast.error(e.message)}
  },[tx])

  const filtered=tx.rows.filter(t=>!filter||`${t.date} ${t.txtype} ${t.description}`.toLowerCase().includes(filter.toLowerCase()))

  function exportExcel(){
    const h=['Date','Type','Description','Paid In','Paid Out','Balance','Validation']
    const rows=tx.rows.map(t=>[t.date,t.txtype,t.description,t.paidin?parseFloat(t.paidin):'',t.paidout?parseFloat(t.paidout):'',t.balance?parseFloat(t.balance):'',t._val?.status||''])
    const ws=XLSX.utils.aoa_to_sheet([h,...rows])
    const ah=['Time','Row','Field','Original','Edited']
    const ar=tx.audit.map(e=>[e.ts.toLocaleString(),e.row+1,e.label,e.orig,e.edited])
    const ws2=XLSX.utils.aoa_to_sheet([ah,...ar])
    const wb=XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb,ws,'Transactions')
    XLSX.utils.book_append_sheet(wb,ws2,'Audit Trail')
    XLSX.writeFile(wb,`${fileName.replace(/\.pdf$/i,'')||'statement'}.xlsx`)
    toast.success('Excel exported with audit trail')
  }

  const TYPES=['','POS','DPC','POC','CHG','BAC','S/O','D/D','SBT','BGC','TRF','OTHER']

  return(
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-semibold">Statement Converter</h2><p className="text-sm text-slate-500">{fileName||'Upload a bank statement to begin'}</p></div>
        <div className="flex gap-2">
          {tx.rows.length>0&&<>
            <button onClick={()=>tx.addRow()} className="px-3 py-1.5 border border-border rounded-md text-sm hover:bg-slate-50">+ Add Row</button>
            <button onClick={exportExcel} className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700">⬇ Excel</button>
            {pdfFile&&<button onClick={()=>setShowPdf(s=>!s)} className="px-3 py-1.5 border border-border rounded-md text-sm hover:bg-slate-50">{showPdf?'Hide PDF':'Show PDF'}</button>}
          </>}
        </div>
      </div>

      {proc.active&&(
        <div className="flex items-center gap-3 rounded-lg px-4 py-3" style={{background:'#eef2ff',border:'1px solid #c7d2fe'}}>
          <span className="text-sm font-medium" style={{color:'#4338ca'}}>{proc.msg}</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{background:'#c7d2fe'}}><div className="h-full rounded-full bg-indigo-600 transition-all" style={{width:`${proc.progress}%`}}/></div>
          <span className="text-xs font-bold" style={{color:'#4338ca'}}>{proc.progress}%</span>
        </div>
      )}

      {!tx.rows.length&&!proc.active&&(
        <div className="flex flex-1 flex-col items-center justify-center">
          <label className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-border px-16 py-16 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all"
            onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)handleFile(f)}}>
            <div className="rounded-2xl p-4 text-4xl" style={{background:'#eef2ff'}}>📄</div>
            <div className="text-center"><p className="font-semibold text-base">Drop your bank statement here</p><p className="text-sm text-slate-500 mt-1">PDF · PNG · JPG · TIFF · Max 20MB</p></div>
            <span className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">Choose file</span>
            <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.tiff" onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f)}}/>
          </label>
          <div className="mt-6 flex gap-8 text-xs text-slate-400">
            <span>🧠 Auto-corrects descriptions</span><span>🔒 GDPR compliant</span><span>⚡ Balance validation</span>
          </div>
        </div>
      )}

      {tx.rows.length>0&&(
        <div className={`flex gap-4 flex-1 min-h-0 ${showPdf?'flex-row':'flex-col'}`}>
          <div className="flex flex-col flex-1 min-w-0 rounded-xl border border-border bg-background overflow-hidden">

            {/* Stats */}
            <div className="grid grid-cols-6 gap-2 border-b border-border p-3">
              {([['📄','Total',tx.stats.total,'#2563eb'],['🧠','Learned',tx.stats.autoCorrected,'#7c3aed'],['✗','Errors',tx.stats.errors,'#dc2626'],['⚡','Dupes',tx.stats.duplicates,'#7c3aed'],['🚩','Flags',tx.stats.redFlags,'#be123c'],['✓','Verified',0,'#16a34a']] as const).map(([icon,label,val,color])=>(
                <div key={label} className="flex items-center gap-2 rounded-lg border border-border p-2">
                  <span className="text-base">{icon}</span>
                  <div><p className="text-[10px] text-slate-500">{label}</p><p className="text-base font-bold" style={{color:String(color)}}>{val}</p></div>
                </div>
              ))}
            </div>

            {/* Recon */}
            {tx.recon&&(
              <div className={`flex items-center gap-2 px-4 py-2.5 border-b border-border text-xs flex-wrap ${tx.recon.status==='balanced'?'bg-green-50':tx.recon.status==='warning'?'bg-amber-50':'bg-red-50'}`}>
                <span className="font-bold text-slate-500 uppercase tracking-wide text-[10px]">Reconciliation</span>
                {([['Opening',tx.recon.openingBalance,'#2563eb'],['+','',''  ],['Paid In',tx.recon.totalIn,'#16a34a'],['−','',''  ],['Paid Out',tx.recon.totalOut,'#dc2626'],['=','',''  ],['Calculated',tx.recon.calculatedClose,'#6366f1'],['vs','',''  ],['Actual',tx.recon.actualClose,'#d97706']] as const).map(([l,v,c],i)=>(
                  typeof v==='number'
                    ?<div key={i} className="flex flex-col items-center rounded-lg border border-slate-200 bg-white/70 px-3 py-1.5"><span className="text-[9px] uppercase tracking-wide text-slate-400">{l}</span><span className="font-bold" style={{color:String(c)}}>£{Number(v).toLocaleString('en-GB',{minimumFractionDigits:2})}</span></div>
                    :<span key={i} className="text-base font-light text-slate-400">{l}</span>
                ))}
                <div className={`ml-auto rounded-full px-3 py-1 font-bold text-xs ${tx.recon.status==='balanced'?'bg-green-200 text-green-800':tx.recon.status==='warning'?'bg-amber-200 text-amber-800':'bg-red-200 text-red-800'}`}>
                  {tx.recon.status==='balanced'?'✓ Balanced':tx.recon.status==='warning'?`⚠ £${Math.abs(tx.recon.diff).toFixed(2)} rounding`:`✗ £${Math.abs(tx.recon.diff).toFixed(2)} discrepancy`}
                </div>
              </div>
            )}

            {/* Filter */}
            <div className="flex items-center gap-2 border-b border-border px-4 py-2 bg-slate-50">
              <input placeholder="🔍 Search…" value={filter} onChange={e=>setFilter(e.target.value)} className="h-7 rounded-md border px-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 w-48"/>
              <span className="ml-auto text-xs text-slate-400">{filtered.length}/{tx.rows.length} rows</span>
            </div>

            {/* Bulk bar */}
            {tx.selectedCount>0&&(
              <div className="flex items-center gap-2 border-b border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                <span>{tx.selectedCount} selected</span>
                <button onClick={tx.bulkVerify} className="ml-2 px-3 py-1 bg-green-100 text-green-700 rounded text-xs border border-green-200">✓ Verify</button>
                <button onClick={tx.bulkDelete} className="px-3 py-1 bg-red-100 text-red-600 rounded text-xs border border-red-200">🗑 Delete</button>
                <button onClick={()=>tx.toggleSelectAll(false)} className="ml-auto text-blue-400 text-xs">✕ Deselect</button>
              </div>
            )}

            {/* Table */}
            <div className="table-scroll flex-1">
              <table className="sticky-table w-full border-collapse text-xs">
                <thead><tr>
                  <th className="w-8 px-3 py-2.5 border-b border-border"><input type="checkbox" onChange={e=>tx.toggleSelectAll(e.target.checked)}/></th>
                  {['Date','Type','Description','Paid In','Paid Out','Balance','✓','Actions'].map(h=>(
                    <th key={h} className="px-3 py-2.5 text-left border-b border-border text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map((t)=>{
                    const ri=tx.rows.findIndex(r=>r.id===t.id)
                    const rc=t._val?.status==='error'?'row-error':t._val?.status==='warn'?'row-warn':t._isDuplicate?'row-dup':t._isRedFlag?'row-flag':''
                    return(
                      <tr key={t.id} className={`border-b border-border hover:bg-slate-50 transition-colors group ${rc}`}>
                        <td className="px-3 py-2"><input type="checkbox" checked={t._selected} onChange={e=>tx.toggleSelect(t.id,e.target.checked)}/></td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                          <input className="cell-input w-24" defaultValue={t.date} onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur()}} onBlur={e=>{if(e.target.value!==t.date)tx.editCell(ri,'date',e.target.value)}}/>
                        </td>
                        <td className="px-3 py-2">
                          <select className="rounded border-transparent bg-transparent text-xs font-semibold text-indigo-600 cursor-pointer" value={t.txtype} onChange={e=>tx.editCell(ri,'txtype',e.target.value)}>
                            {TYPES.map(v=><option key={v} value={v}>{v||'—'}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2 max-w-[220px]">
                          <input className="cell-input w-full" defaultValue={t.description} onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur()}} onBlur={e=>{if(e.target.value!==t.description)tx.editCell(ri,'description',e.target.value)}}/>
                          <div className="flex gap-1 mt-0.5 flex-wrap">
                            {t._auto_corrected&&<span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-violet-100 text-violet-700">🧠 Learned</span>}
                            {t._isRedFlag&&<span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700">🚩 Flag</span>}
                            {t._isDuplicate&&<span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-700">⚡ Dup</span>}
                            {t._suggested&&<button onClick={()=>setLearn({open:true,idx:ri,raw:t.description,corrected:t._suggestion||''})} className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700">✨ {t._suggestion}?</button>}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <input className="cell-input w-20 text-right font-mono" style={{color:'#16a34a'}} defaultValue={t.paidin} placeholder="—" onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur()}} onBlur={e=>{if(e.target.value!==t.paidin)tx.editCell(ri,'paidin',e.target.value)}}/>
                            {t.paidout&&!t.paidin&&<button onClick={()=>tx.moveAmount(ri,'toIn')} className="text-[10px] rounded px-1 border" style={{background:'#f0fdf4',color:'#16a34a',borderColor:'#bbf7d0'}}>←In</button>}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <input className="cell-input w-20 text-right font-mono" style={{color:'#dc2626'}} defaultValue={t.paidout} placeholder="—" onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur()}} onBlur={e=>{if(e.target.value!==t.paidout)tx.editCell(ri,'paidout',e.target.value)}}/>
                            {t.paidin&&!t.paidout&&<button onClick={()=>tx.moveAmount(ri,'toOut')} className="text-[10px] rounded px-1 border" style={{background:'#fef2f2',color:'#dc2626',borderColor:'#fecaca'}}>Out→</button>}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <input className={`cell-input w-20 text-right font-mono ${t._val?.balImpossible?'border-red-400 bg-red-50':''}`} style={{color:'#d97706'}} defaultValue={t.balance} placeholder="—" onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur()}} onBlur={e=>{if(e.target.value!==t.balance)tx.editCell(ri,'balance',e.target.value)}}/>
                          {t._val?.balImpossible&&<p className="text-[9px] font-bold" style={{color:'#dc2626'}}>Exp:£{t._val.expected?.toFixed(2)}</p>}
                        </td>
                        <td className="px-3 py-2">
                          {!t._val||t._val.status==='skip'?<span className="text-slate-300">—</span>:
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${t._val.status==='ok'?'bg-green-100 text-green-700':t._val.status==='warn'?'bg-amber-100 text-amber-700':'bg-red-100 text-red-700'}`}>
                            {t._val.status==='ok'?'✓ OK':t._val.status==='warn'?`⚠ £${Math.abs(t._val.diff).toFixed(2)}`:`✗ £${Math.abs(t._val.diff).toFixed(2)}`}
                          </span>}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={()=>tx.addRow(ri)} title="Insert above" className="p-1 rounded hover:bg-slate-100 text-slate-400">↑+</button>
                            <button onClick={()=>tx.addRow(ri+1)} title="Insert below" className="p-1 rounded hover:bg-slate-100 text-slate-400">↓+</button>
                            <button onClick={()=>tx.duplicateRow(ri)} title="Duplicate" className="p-1 rounded hover:bg-slate-100 text-slate-400">⧉</button>
                            <button onClick={()=>tx.deleteRow(ri)} title="Delete" className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600">✕</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {showPdf&&pdfFile&&<div className="w-96 shrink-0"><PdfViewer file={pdfFile}/></div>}
        </div>
      )}

      <SaveMemoryModal open={learn.open} raw={learn.raw} corrected={learn.corrected} onClose={()=>setLearn(s=>({...s,open:false}))}
        onSave={async(raw,corr,cat,remember)=>{
          if(!remember)return
          await fetch('/api/learn',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({raw_text:raw,corrected_text:corr,category:cat,remember,session_id:session,row_index:learn.idx})})
          toast.success('Saved to dictionary 🧠')
        }}/>
    </div>
  )
}
