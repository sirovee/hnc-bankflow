'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
export default function LoginPage(){
  const router=useRouter()
  const[email,setEmail]=useState('')
  const[password,setPassword]=useState('')
  const[loading,setLoading]=useState(false)
  async function handleLogin(e:React.FormEvent){
    e.preventDefault();setLoading(true)
    const{error}=await createClient().auth.signInWithPassword({email,password})
    if(error){toast.error('Incorrect email or password');setLoading(false);return}
    router.push('/dashboard')
  }
  async function handleMs(){
    const{error}=await createClient().auth.signInWithOAuth({provider:'azure',options:{scopes:'email profile',redirectTo:`${window.location.origin}/dashboard`}})
    if(error)toast.error(error.message)
  }
  return(
    <div className="w-full max-w-sm">
      <div className="rounded-2xl border bg-white p-8 shadow-xl">
        <h1 className="text-xl font-bold text-center mb-1">Welcome back</h1>
        <p className="text-sm text-center mb-6" style={{color:'#64748b'}}>Sign in to your BankFlow account</p>
        <button onClick={handleMs} className="mb-4 w-full flex items-center justify-center gap-3 rounded-lg border py-2.5 text-sm font-medium hover:bg-slate-50 transition">
          <svg width="18" height="18" viewBox="0 0 21 21"><rect x="0" y="0" width="9.5" height="9.5" fill="#f25022"/><rect x="11" y="0" width="9.5" height="9.5" fill="#7fba00"/><rect x="0" y="11" width="9.5" height="9.5" fill="#00a4ef"/><rect x="11" y="11" width="9.5" height="9.5" fill="#ffb900"/></svg>
          Continue with Microsoft
        </button>
        <div className="relative mb-4"><div className="absolute inset-0 flex items-center"><span className="w-full border-t"/></div><div className="relative flex justify-center text-xs"><span className="bg-white px-2 uppercase" style={{color:'#94a3b8'}}>or email</span></div></div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div><label className="text-sm font-medium block mb-1.5">Email</label><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@firm.co.uk" className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500"/></div>
          <div>
            <div className="flex justify-between mb-1.5"><label className="text-sm font-medium">Password</label><span className="text-xs text-indigo-600 cursor-pointer">Forgot?</span></div>
            <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500"/>
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition">{loading?'Signing in…':'Sign in'}</button>
        </form>
        <p className="mt-4 text-center text-xs" style={{color:'#64748b'}}>No account? <Link href="/register" className="text-indigo-600 font-medium hover:underline">Request access</Link></p>
      </div>
    </div>
  )
}
