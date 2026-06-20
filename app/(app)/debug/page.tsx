'use client'
import { useState } from 'react'

export default function DebugPage(){
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')

  async function handleFile(file: File){
    setFileName(file.name); setLoading(true); setError(''); setResult(null)
    const form = new FormData(); form.append('file', file)
    try{
      const res = await fetch('/api/process-pdf?debug=1', { method:'POST', body:form })
      const data = await res.json()
      if(!res.ok) throw new Error(data.error || `Error ${res.status}`)
      setResult(data.debug)
    }catch(e:any){ setError(e.message) }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">🔬 Doc AI Debug Inspector</h1>
        <p className="text-sm text-slate-500 mb-6">Upload any bank statement to see exactly what Google Document AI returns. Screenshot the output and send it to Claude.</p>

        <label className="block rounded-2xl border-2 border-dashed border-slate-300 p-10 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all mb-6">
          <div className="text-4xl mb-3">📄</div>
          <p className="font-semibold">Drop a bank statement PDF here</p>
          <p className="text-sm text-slate-500 mt-1">{fileName || 'Any UK bank — NatWest, Barclays, HSBC, etc.'}</p>
          <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.tiff"
            onChange={e=>{const f=e.target.files?.[0]; if(f)handleFile(f)}}/>
        </label>

        {loading && <div className="text-center py-8 text-indigo-600 font-medium">Processing… (this calls Google, ~5-10s)</div>}
        {error && <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-600 text-sm mb-4">{error}</div>}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Text length" value={result.textLength}/>
              <Stat label="Entities" value={result.entityCount}/>
              <Stat label="Pages" value={result.pageCount}/>
              <Stat label="Tables/page" value={JSON.stringify(result.tablesPerPage)}/>
            </div>

            <Block title="Entity Types Found">
              {result.entityTypes?.length
                ? <div className="flex flex-wrap gap-2">{result.entityTypes.map((t:string)=>(
                    <span key={t} className="rounded bg-violet-100 text-violet-700 px-2 py-1 text-xs font-mono">{t}</span>))}</div>
                : <span className="text-slate-400 text-sm">No entities returned</span>}
            </Block>

            <Block title="First Table — Header Cells">
              {result.firstTableHeader?.length
                ? <div className="flex flex-wrap gap-2">{result.firstTableHeader.map((h:string,i:number)=>(
                    <span key={i} className="rounded bg-blue-100 text-blue-700 px-2 py-1 text-xs font-mono">{h||'(empty)'}</span>))}</div>
                : <span className="text-slate-400 text-sm">No tables detected</span>}
            </Block>

            <Block title="First Table — First 3 Body Rows">
              {result.firstTableRows?.length
                ? <div className="space-y-2">{result.firstTableRows.map((row:string[],i:number)=>(
                    <div key={i} className="flex flex-wrap gap-2 border-b pb-2">{row.map((c,j)=>(
                      <span key={j} className="rounded bg-slate-100 px-2 py-1 text-xs font-mono">{c||'—'}</span>))}</div>))}</div>
                : <span className="text-slate-400 text-sm">No table rows</span>}
            </Block>

            <Block title="🔑 Sample Entities (table_item internals)">
              <pre className="text-xs bg-slate-900 text-green-400 p-3 rounded overflow-auto max-h-80">{JSON.stringify(result.sampleEntities, null, 2)}</pre>
            </Block>

            <Block title="Sample: parseFromTables() output">
              <pre className="text-xs bg-slate-900 text-green-400 p-3 rounded overflow-auto max-h-60">{JSON.stringify(result.sampleParseFromTables, null, 2)}</pre>
            </Block>

            <Block title="Sample: parseFromText() output">
              <pre className="text-xs bg-slate-900 text-green-400 p-3 rounded overflow-auto max-h-60">{JSON.stringify(result.sampleParseFromText, null, 2)}</pre>
            </Block>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({label,value}:{label:string;value:any}){
  return <div className="rounded-xl border border-slate-200 bg-white p-4">
    <p className="text-xs text-slate-500">{label}</p>
    <p className="text-lg font-bold mt-1">{value}</p>
  </div>
}
function Block({title,children}:{title:string;children:React.ReactNode}){
  return <div className="rounded-xl border border-slate-200 bg-white p-4">
    <h3 className="text-sm font-semibold mb-3">{title}</h3>
    {children}
  </div>
}
