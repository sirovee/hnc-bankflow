'use client'
import { useEffect, useState } from 'react'
import { Brain, Trash2, Globe, User, Search, TrendingUp } from 'lucide-react'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Badge }    from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast }    from 'sonner'

interface Entry {
  id: string; original_text: string; corrected_text: string
  category: string|null; trust_score: number; hit_count: number
  is_global: boolean; unique_user_count: number
}

export default function DictionaryPage() {
  const [entries, setEntries]   = useState<Entry[]>([])
  const [loading, setLoading]   = useState(true)
  const [query,   setQuery]     = useState('')
  const [tab,     setTab]       = useState<'mine'|'global'>('mine')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const res  = await fetch('/api/dict')
    const data = await res.json()
    setEntries(data.mappings || [])
    setLoading(false)
  }

  async function del(id: string) {
    if (!confirm('Delete this mapping?')) return
    await fetch(`/api/dict?id=${id}`, { method: 'DELETE' })
    toast.success('Mapping deleted')
    load()
  }

  const filtered = entries
    .filter(e => tab === 'global' ? e.is_global : !e.is_global)
    .filter(e => !query || `${e.original_text} ${e.corrected_text}`.toLowerCase().includes(query.toLowerCase()))

  const trustColor = (s: number) =>
    s >= 80 ? 'success' : s >= 50 ? 'warning' : 'secondary'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Smart Dictionary</h2>
          <p className="text-sm text-muted-foreground">
            {entries.filter(e=>!e.is_global).length} personal · {entries.filter(e=>e.is_global).length} global mappings
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-lg border border-border bg-muted/30 px-3 py-2">
          <TrendingUp className="h-3.5 w-3.5 text-violet-500"/>
          Mappings reaching 10 users auto-promote to Global
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center gap-3">
        <div className="flex rounded-lg border border-border p-0.5 bg-muted/30">
          {(['mine','global'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition ${tab===t ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {t === 'mine' ? <User className="h-3.5 w-3.5"/> : <Globe className="h-3.5 w-3.5"/>}
              {t === 'mine' ? 'My Dictionary' : 'Global'}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/>
          <Input placeholder="Search mappings…" className="pl-9" value={query} onChange={e=>setQuery(e.target.value)}/>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">OCR Original</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Corrected To</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trust</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Used</th>
              {tab==='global' && <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Users</th>}
              <th className="px-4 py-3"/>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && Array.from({length:6}).map((_,i) => (
              <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-4"/></td></tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="py-16 text-center text-sm text-muted-foreground">
                {query ? 'No mappings match your search.' : tab==='mine' ? 'No personal mappings yet. Edit a cell and save to memory!' : 'No global mappings yet.'}
              </td></tr>
            )}
            {!loading && filtered.map(e => (
              <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{e.original_text}</td>
                <td className="px-4 py-3 font-medium">{e.corrected_text}</td>
                <td className="px-4 py-3">{e.category ? <span className="text-xs">{e.category}</span> : <span className="text-xs text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${e.trust_score>=80?'bg-green-500':e.trust_score>=50?'bg-amber-500':'bg-muted-foreground'}`} style={{width:`${e.trust_score}%`}}/>
                    </div>
                    <span className="text-xs text-muted-foreground">{e.trust_score}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{e.hit_count}×</td>
                {tab==='global' && <td className="px-4 py-3"><Badge variant="secondary" className="text-xs">{e.unique_user_count} users</Badge></td>}
                <td className="px-4 py-3">
                  {!e.is_global && (
                    <button onClick={() => del(e.id)} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 transition">
                      <Trash2 className="h-3.5 w-3.5"/>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
