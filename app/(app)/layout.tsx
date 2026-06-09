'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
const NAV=[{href:'/dashboard',label:'Dashboard',icon:'📊'},{href:'/converter',label:'Converter',icon:'📄'},{href:'/dictionary',label:'Dictionary',icon:'🧠'},{href:'/audit',label:'Audit Log',icon:'🕵'},{href:'/settings',label:'Settings',icon:'⚙️'}]
export default function AppLayout({children}:{children:React.ReactNode}){
  const pathname=usePathname(),router=useRouter()
  async function signOut(){await createClient().auth.signOut();router.push('/login')}
  return(
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="flex w-56 flex-col shrink-0" style={{background:'#0f172a'}}>
        <div className="flex h-14 items-center gap-2.5 px-4" style={{borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm">⚡</div>
          <span className="text-sm font-semibold text-white">HNC <span className="text-indigo-400">BankFlow</span></span>
        </div>
        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {NAV.map(({href,label,icon})=>(
            <Link key={href} href={href} className={cn('flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',pathname.startsWith(href)?'bg-indigo-600 text-white':'text-slate-400 hover:text-white')}>
              <span>{icon}</span>{label}
            </Link>
          ))}
        </nav>
        <div className="p-2" style={{borderTop:'1px solid rgba(255,255,255,0.07)'}}>
          <button onClick={signOut} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-400 hover:text-red-400 transition-colors">🚪 Sign out</button>
        </div>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
          <h1 className="text-sm font-semibold">{NAV.find(n=>pathname.startsWith(n.href))?.label??'BankFlow'}</h1>
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">Pro Plan</span>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
