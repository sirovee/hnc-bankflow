'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
export default function RegisterPage(){
  const router=useRouter()
  const[form,setForm]=useState({name:'',company:'',email:'',password:'',confirm:''})
  const[loading,setLoading]=useState(false)
  const set=(k:keyof typeof form)=>(e:React.ChangeEvent<HTMLInputElement>)=>setForm(f=>({...f,[k]:e.target.value}))
  async function handleSubmit(e:React.FormEvent){
    e.preventDefault()
    if(form.password!==form.confirm){toast.error('Passwords do not match');return}
    if(form.password.length<8){toast.error('Password must be 8+ characters');return}
    setLoading(true)
    const{error}=await createClient().auth.signUp({email:form.email,password:form.password,options:{data:{full_name:form.name,company_name:form.company}}})
    if(error){toast.error(error.message);setLoading(false);return}
    toast.success('Account created! Check your email.')
    router.push('/login')
  }
  const fields:[keyof typeof form,string,string,string][]=[['name','Full name','Jane Smith','text'],['company','Firm name','Hudson Weir Ltd','text'],['email','Work email','you@firm.co.uk','email'],['password','Password','Min 8 characters','password'],['confirm','Confirm password','Repeat password','password']]
  return(
    <div className="w-full max-w-sm">
      <div className="rounded-2xl border bg-white p-8 shadow-xl">
        <h1 className="text-xl font-bold text-center mb-1">Create account</h1>
        <p className="text-sm text-center mb-6" style={{color:'#64748b'}}>Start processing statements today</p>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {fields.map(([k,label,ph,type])=>(
            <div key={k}><label className="text-sm font-medium block mb-1.5">{label}</label><input type={type} placeholder={ph} required value={form[k]} onChange={set(k)} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500"/></div>
          ))}
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition">{loading?'Creating…':'Create account'}</button>
        </form>
        <p className="mt-4 text-center text-xs" style={{color:'#64748b'}}>Already have an account? <Link href="/login" className="text-indigo-600 font-medium hover:underline">Sign in</Link></p>
      </div>
    </div>
  )
}
