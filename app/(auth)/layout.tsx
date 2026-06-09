export default function AuthLayout({children}:{children:React.ReactNode}){
  return(
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-4">
      <div className="mb-8 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white text-xl font-bold shadow-lg">⚡</div>
        <span className="text-xl font-bold">HNC <span className="text-indigo-600">BankFlow</span></span>
      </div>
      {children}
      <p className="mt-6 text-xs text-center" style={{color:'#94a3b8'}}>Professional insolvency statement processing · GDPR compliant · UK-based</p>
    </div>
  )
}
