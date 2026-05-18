import { Zap } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-4">

      {/* Logo */}
      <div className="mb-8 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/25">
          <Zap className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold tracking-tight">
          HNC <span className="text-primary">BankFlow</span>
        </span>
      </div>

      {children}

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Professional insolvency statement processing · GDPR compliant · UK-based
      </p>
    </div>
  )
}
