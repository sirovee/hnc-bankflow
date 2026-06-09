import Link from 'next/link'
export default function DashboardPage(){
  const stats=[
    {label:'Statements',value:'142',change:'+12 this week',color:'#2563eb',bg:'#eff6ff',icon:'📄'},
    {label:'Auto-Corrected',value:'2,847',change:'+340 this week',color:'#7c3aed',bg:'#ede9fe',icon:'🧠'},
    {label:'Errors',value:'23',change:'-8 vs last week',color:'#d97706',bg:'#fef3c7',icon:'⚠️'},
    {label:'Verified',value:'18,421',change:'98.7% accuracy',color:'#16a34a',bg:'#f0fdf4',icon:'✅'},
  ]
  const recent=[
    {name:'NatWest_Jan2024.pdf',rows:56,status:'balanced',time:'2 mins ago'},
    {name:'Barclays_Q1_2024.pdf',rows:143,status:'warning',time:'1 hour ago'},
    {name:'HSBC_Statement.pdf',rows:89,status:'balanced',time:'3 hours ago'},
    {name:'Lloyds_Feb24.pdf',rows:211,status:'error',time:'Yesterday'},
  ]
  return(
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-semibold">Good morning 👋</h2><p className="text-sm" style={{color:'#64748b'}}>Here&apos;s what&apos;s happening with your statements.</p></div>
        <Link href="/converter" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition">📄 New Statement</Link>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {stats.map(s=>(
          <div key={s.label} className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-start justify-between">
              <div><p className="text-xs font-medium" style={{color:'#64748b'}}>{s.label}</p><p className="mt-1 text-2xl font-bold" style={{color:s.color}}>{s.value}</p><p className="mt-0.5 text-xs" style={{color:'#94a3b8'}}>{s.change}</p></div>
              <div className="rounded-lg p-2 text-lg" style={{background:s.bg}}>{s.icon}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 rounded-xl border border-border bg-background">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-semibold">Recent Statements</h3>
            <Link href="/converter" className="text-xs text-indigo-600 hover:underline">Process new →</Link>
          </div>
          {recent.map(r=>(
            <div key={r.name} className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-slate-100 p-2 text-sm">📄</div>
                <div><p className="text-sm font-medium">{r.name}</p><p className="text-xs" style={{color:'#94a3b8'}}>{r.rows} transactions · {r.time}</p></div>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${r.status==='balanced'?'bg-green-100 text-green-700':r.status==='warning'?'bg-amber-100 text-amber-700':'bg-red-100 text-red-700'}`}>
                {r.status==='balanced'?'✓ Balanced':r.status==='warning'?'⚠ Warnings':'✗ Errors'}
              </span>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-background">
          <div className="border-b border-border px-5 py-3.5"><h3 className="text-sm font-semibold">🧠 Learning Engine</h3></div>
          <div className="space-y-4 p-5">
            {[['Dictionary entries','847',72,'#7c3aed'],['Global mappings','124',35,'#2563eb'],['Auto-correct rate','91%',91,'#16a34a']].map(([l,v,w,c])=>(
              <div key={String(l)}>
                <div className="flex justify-between text-xs mb-1.5"><span style={{color:'#64748b'}}>{l}</span><span className="font-medium">{v}</span></div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{width:`${w}%`,background:c}}/></div>
              </div>
            ))}
            <div className="rounded-lg p-3 text-xs" style={{background:'#f5f3ff',color:'#5b21b6'}}><strong>3 mappings</strong> ready to promote to global.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
