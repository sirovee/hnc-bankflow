import type { ReconciliationSummary } from '@/types'
import { formatGBP } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Props { recon: ReconciliationSummary }

export default function ReconciliationBar({ recon }: Props) {
  const { openingBalance, totalIn, totalOut, calculatedClose, actualClose, diff, status } = recon
  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border px-5 py-3 text-sm flex-wrap',
      status === 'balanced' ? 'border-green-200 bg-green-50' :
      status === 'warning'  ? 'border-amber-200 bg-amber-50' :
                              'border-red-200 bg-red-50'
    )}>
      <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">Reconciliation</span>
      <Cell label="Opening" value={formatGBP(openingBalance)} />
      <Op>+</Op>
      <Cell label="Total In"  value={formatGBP(totalIn)}  className="text-green-700"/>
      <Op>−</Op>
      <Cell label="Total Out" value={formatGBP(totalOut)} className="text-red-600"/>
      <Op>=</Op>
      <Cell label="Calculated" value={formatGBP(calculatedClose)} />
      <span className="text-muted-foreground text-xs">vs</span>
      <Cell label="Statement"  value={formatGBP(actualClose)} />
      <div className={cn(
        'ml-auto rounded-full px-3 py-1 text-xs font-bold',
        status === 'balanced' ? 'bg-green-200 text-green-800' :
        status === 'warning'  ? 'bg-amber-200 text-amber-800' :
                                'bg-red-200 text-red-800'
      )}>
        {status === 'balanced' ? '✓ Balanced'
         : status === 'warning' ? `⚠ £${Math.abs(diff).toFixed(2)} rounding`
         : `✗ £${Math.abs(diff).toFixed(2)} discrepancy`}
      </div>
    </div>
  )
}

function Cell({ label, value, className }: { label:string; value:string; className?:string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`font-bold text-sm ${className||''}`}>{value}</span>
    </div>
  )
}

function Op({ children }: { children: string }) {
  return <span className="text-lg font-light text-muted-foreground">{children}</span>
}
