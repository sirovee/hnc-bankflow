import { FileText, Brain, AlertTriangle, CheckCircle, Copy, Flag } from 'lucide-react'
import type { ProcessingStats, ReconciliationSummary } from '@/types'

interface Props { stats: ProcessingStats; recon: ReconciliationSummary | null }

export default function StatCards({ stats, recon }: Props) {
  const cards = [
    { label:'Transactions',   value: stats.total,         icon: FileText,       color:'text-blue-600',   bg:'bg-blue-50'   },
    { label:'Auto-Corrected', value: stats.autoCorrected, icon: Brain,          color:'text-violet-600', bg:'bg-violet-50' },
    { label:'Errors',         value: stats.errors,        icon: AlertTriangle,  color:'text-red-600',    bg:'bg-red-50'    },
    { label:'Duplicates',     value: stats.duplicates,    icon: Copy,           color:'text-purple-600', bg:'bg-purple-50' },
    { label:'Red Flags',      value: stats.redFlags,      icon: Flag,           color:'text-rose-600',   bg:'bg-rose-50'   },
    { label:'Verified',       value: 0,                   icon: CheckCircle,    color:'text-green-600',  bg:'bg-green-50'  },
  ]
  return (
    <div className="grid grid-cols-6 gap-3">
      {cards.map(c => (
        <div key={c.label} className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-3">
          <div className={`rounded-lg p-1.5 ${c.bg}`}>
            <c.icon className={`h-4 w-4 ${c.color}`} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">{c.label}</p>
            <p className={`text-lg font-bold leading-none ${c.value > 0 && c.label !== 'Transactions' && c.label !== 'Verified' && c.label !== 'Auto-Corrected' ? c.color : ''}`}>{c.value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
