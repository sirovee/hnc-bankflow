'use client'
import { useEffect, useRef, useState } from 'react'
interface Props{file:File}
export default function PdfViewer({file}:Props){
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const pdfRef=useRef<any>(null)
  const[page,setPage]=useState(1)
  const[total,setTotal]=useState(1)
  const[scale,setScale]=useState(1.2)
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState('')
  useEffect(()=>{
    let cancelled=false
    async function load(){
      try{
        const lib=await import('pdfjs-dist')
        lib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.3.136/pdf.worker.min.mjs'
        if(pdfRef.current){try{await pdfRef.current.destroy()}catch{}}
        const url=URL.createObjectURL(file)
        const pdf=await lib.getDocument(url).promise
        if(cancelled)return
        pdfRef.current=pdf;setTotal(pdf.numPages);setPage(1);setLoading(false)
      }catch(e:any){if(!cancelled)setError(e?.message||'Failed to load PDF')}
    }
    load()
    return()=>{cancelled=true}
  },[file])
  useEffect(()=>{
    if(!pdfRef.current||loading)return
    let cancelled=false
    async function render(){
      try{
        const pg=await pdfRef.current.getPage(page)
        const vp=pg.getViewport({scale})
        const canvas=canvasRef.current
        if(!canvas||cancelled)return
        canvas.width=vp.width;canvas.height=vp.height
        const ctx=canvas.getContext('2d')!
        ctx.clearRect(0,0,canvas.width,canvas.height)
        await pg.render({canvasContext:ctx,viewport:vp}).promise
      }catch{}
    }
    render()
    return()=>{cancelled=true}
  },[page,scale,loading])
  if(error)return<div className="flex h-full items-center justify-center rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">{error}</div>
  return(
    <div className="flex h-full flex-col rounded-xl border border-border bg-background overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-border bg-slate-50 px-3 py-2 text-xs">
        <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1} className="px-2 py-1 border rounded disabled:opacity-40">◀</button>
        <span className="min-w-[70px] text-center text-slate-500">{loading?'…':`${page} / ${total}`}</span>
        <button onClick={()=>setPage(p=>Math.min(total,p+1))} disabled={page>=total} className="px-2 py-1 border rounded disabled:opacity-40">▶</button>
        <div className="mx-1 h-4 w-px bg-border"/>
        <button onClick={()=>setScale(s=>Math.max(0.4,+(s-0.2).toFixed(1)))} className="px-2 py-1 border rounded">−</button>
        <span className="min-w-[40px] text-center font-medium">{Math.round(scale*100)}%</span>
        <button onClick={()=>setScale(s=>Math.min(3,+(s+0.2).toFixed(1)))} className="px-2 py-1 border rounded">+</button>
        <button onClick={()=>setScale(1.2)} className="ml-auto px-2 py-1 border rounded">⊙</button>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {loading?<div className="flex h-full items-center justify-center text-sm text-slate-400">Loading PDF…</div>:<canvas ref={canvasRef} className="block rounded shadow-sm"/>}
      </div>
    </div>
  )
}
