import { FileText, CheckCircle, AlertTriangle, Brain, TrendingUp, Clock } from 'lucide-react'
import Link from 'next/link'

const STATS = [
  { label: 'Statements Processed',  value: '142',   change: '+12 this week', icon: FileText,       color: 'text-blue-600',   bg: 'bg-blue-50'   },
  { label: 'Auto-Corrections Made', value: '2,847',  change: '+340 this week', icon: Brain,         color: 'text-violet-600', bg: 'bg-violet-50' },
  { label: 'Validation Errors',     value: '23',    change: '-8 vs last week', icon: AlertTriangle,  color: 'text-amber-600',  bg: 'bg-amber-50'  },
  { label: 'Verified Transactions', value: '18,421', change: '98.7% accuracy',  icon: CheckCircle,   color: 'text-green-600',  bg: 'bg-green-50'  },
]

const RECENT = [
  { name: 'NatWest_Jan2024.pdf',  date: '2 mins ago',  rows: 56,  status: 'balanced', errors: 0 },
  { name: 'Barclays_Q1_2024.pdf', date: '1 hour ago',  rows: 143, status: 'warning',  errors: 3 },
  { name: 'HSBC_Statement.pdf',   date: '3 hours ago', rows: 89,  status: 'balanced', errors: 0 },
  { name: 'Lloyds_Feb24.pdf',     date: 'Yesterday',   rows: 211, status: 'error',    errors: 7 },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Good morning 👋</h2>
          <p className="text-sm text-muted-foreground">Here's what's happening with your statements.</p>
        </div>
        <Link
          href="/converter"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          <FileText className="h-4 w-4" /> New Statement
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-4">
        {STATS.map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight">{s.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.change}</p>
              </div>
              <div className={`rounded-lg p-2 ${s.bg}`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Two column */}
      <div className="grid grid-cols-3 gap-4">

        {/* Recent statements */}
        <div className="col-span-2 rounded-xl border border-border bg-background">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-semibold">Recent Statements</h3>
            <Link href="/converter" className="text-xs text-primary hover:underline">Process new →</Link>
          </div>
          <div className="divide-y divide-border">
            {RECENT.map(r => (
              <div key={r.name} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.rows} transactions · {r.date}</p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  r.status === 'balanced' ? 'bg-green-100 text-green-700' :
                  r.status === 'warning'  ? 'bg-amber-100 text-amber-700' :
                                            'bg-red-100 text-red-700'
                }`}>
                  {r.status === 'balanced' ? '✓ Balanced' : r.status === 'warning' ? `⚠ ${r.errors} warnings` : `✗ ${r.errors} errors`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Learning engine status */}
        <div className="rounded-xl border border-border bg-background">
          <div className="border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-semibold">🧠 Learning Engine</h3>
          </div>
          <div className="space-y-4 p-5">
            <div>
              <div className="mb-1.5 flex justify-between text-xs">
                <span className="text-muted-foreground">Dictionary entries</span>
                <span className="font-medium">847</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-[72%] rounded-full bg-violet-500" />
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-xs">
                <span className="text-muted-foreground">Global mappings</span>
                <span className="font-medium">124</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-[35%] rounded-full bg-blue-500" />
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-xs">
                <span className="text-muted-foreground">Auto-correct rate</span>
                <span className="font-medium text-green-600">91%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-[91%] rounded-full bg-green-500" />
              </div>
            </div>
            <div className="rounded-lg bg-violet-50 p-3 text-xs text-violet-700">
              <strong>3 mappings</strong> ready to promote to global. 
              <Link href="/dictionary" className="ml-1 underline">Review →</Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
