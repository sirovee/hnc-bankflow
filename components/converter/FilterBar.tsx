'use client'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface FilterState { query:string; minAmt:string; maxAmt:string; txtype:string; status:string }
interface Props {
  filter: FilterState
  onChange: (f: FilterState) => void
  totalCount: number
  filteredCount: number
}

const TYPES   = ['','POS','DPC','POC','CHG','BAC','S/O','D/D','SBT','BGC','TRF']
const STATUSES = [
  { value:'',        label:'All rows'   },
  { value:'error',   label:'Errors'     },
  { value:'warn',    label:'Warnings'   },
  { value:'dup',     label:'Duplicates' },
  { value:'redflag', label:'Red Flags'  },
  { value:'verified',label:'Verified'   },
]

export default function FilterBar({ filter, onChange, totalCount, filteredCount }: Props) {
  const set = (k: keyof FilterState) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
    onChange({ ...filter, [k]: e.target.value })

  const hasFilter = filter.query || filter.minAmt || filter.maxAmt || filter.txtype || filter.status

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 bg-muted/30">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
        <Input placeholder="Search..." className="h-7 w-52 pl-8 text-xs" value={filter.query} onChange={set('query')} />
      </div>
      {/* Amount range */}
      <Input placeholder="Min £" type="number" className="h-7 w-20 text-xs" value={filter.minAmt} onChange={set('minAmt')} />
      <span className="text-xs text-muted-foreground">–</span>
      <Input placeholder="Max £" type="number" className="h-7 w-20 text-xs" value={filter.maxAmt} onChange={set('maxAmt')} />
      {/* Type */}
      <select className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring" value={filter.txtype} onChange={set('txtype')}>
        <option value="">All types</option>
        {TYPES.filter(Boolean).map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      {/* Status */}
      <select className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring" value={filter.status} onChange={set('status')}>
        {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      {/* Clear */}
      {hasFilter && (
        <button onClick={() => onChange({query:'',minAmt:'',maxAmt:'',txtype:'',status:''})}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition">
          <X className="h-3 w-3" /> Clear
        </button>
      )}
      {/* Count */}
      <span className="ml-auto text-xs text-muted-foreground">
        {hasFilter ? `${filteredCount} / ${totalCount}` : `${totalCount} rows`}
      </span>
    </div>
  )
}
