'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
export default function SettingsPage(){
  const[profile,setProfile]=useState({full_name:'',company_name:'',email:''})
  const[logo,setLogo]=useState<string|null>(null)
  const[saving,setSaving]=useState(false)
  const[uploading,setUploading]=useState(false)
  const logoRef=useRef<HTMLInputElement>(null)
  const sb=createClient()
  useEffect(()=>{
    async function load(){
      const{data:{user}}=await sb.auth.getUser()
      if(!user)return
      setProfile({full_name:user.user_metadata.full_name||'',company_name:user.user_metadata.company_name||'',email:user.email||''})
      const res=await fetch('/api/logo');const d=await res.json();if(d.logo_url)setLogo(d.logo_url)
    }
    load()
  },[])
  async function saveProfile(){
    setSaving(true)
    const{error}=await sb.auth.updateUser({data:{full_name:profile.full_name,company_name:profile.company_name}})
    if(error)toast.error(error.message);else toast.success('Profile saved')
    setSaving(false)
  }
  async function uploadLogo(file:File){
    setUploading(true)
    const form=new FormData();form.append('logo',file)
    const res=await fetch('/api/logo',{method:'POST',body:form});const d=await res.json()
    if(!res.ok){toast.error(d.error);setUploading(false);return}
    setLogo(d.logo_url);toast.success('Logo uploaded');setUploading(false)
  }
  const Section=({title,children}:{title:string;children:React.ReactNode})=>(
    <div className="rounded-xl border border-border bg-background overflow-hidden mb-4">
      <div className="border-b border-border px-5 py-3.5 text-sm font-semibold">{title}</div>
      <div className="p-5">{children}</div>
    </div>
  )
  return(
    <div className="max-w-lg space-y-0">
      <div className="mb-5"><h2 className="text-xl font-semibold">Settings</h2><p className="text-sm" style={{color:'#64748b'}}>Manage your profile, branding and plan</p></div>
      <Section title="👤 Profile">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div><label className="text-sm font-medium block mb-1.5">Full name</label><input value={profile.full_name} onChange={e=>setProfile(p=>({...p,full_name:e.target.value}))} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Jane Smith"/></div>
          <div><label className="text-sm font-medium block mb-1.5">Firm name</label><input value={profile.company_name} onChange={e=>setProfile(p=>({...p,company_name:e.target.value}))} className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Hudson Weir Ltd"/></div>
        </div>
        <div className="mb-4"><label className="text-sm font-medium block mb-1.5">Email</label><input value={profile.email} disabled className="w-full rounded-md border px-3 py-2 text-sm bg-slate-50" style={{color:'#94a3b8'}}/></div>
        <button onClick={saveProfile} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">{saving?'Saving…':'Save profile'}</button>
      </Section>
      <Section title="🏢 Export Branding">
        <p className="text-sm mb-3" style={{color:'#64748b'}}>Your logo appears in Excel export headers.</p>
        {logo&&<img src={logo} alt="Logo" className="h-12 rounded border p-1 object-contain mb-3"/>}
        <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)uploadLogo(f)}}/>
        <button onClick={()=>logoRef.current?.click()} disabled={uploading} className="px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-muted disabled:opacity-60">⬆ {uploading?'Uploading…':logo?'Replace logo':'Upload logo'}</button>
        <p className="text-xs mt-2" style={{color:'#94a3b8'}}>PNG · JPG · SVG · Max 2MB</p>
      </Section>
      <Section title="💳 Plan">
        <div className="flex items-center justify-between rounded-lg border p-3 mb-4" style={{background:'#f0fdf4',borderColor:'#bbf7d0'}}>
          <div><p className="text-sm font-semibold" style={{color:'#15803d'}}>Pro Plan</p><p className="text-xs" style={{color:'#16a34a'}}>Unlimited · Learning engine · Priority support</p></div>
          <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-200 text-green-800">Active</span>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[['Statements','142','this month'],['Pages','1,847','processed'],['Dictionary','847','entries']].map(([l,v,s])=>(
            <div key={l} className="rounded-lg border border-border p-3"><p className="text-xs mb-1" style={{color:'#94a3b8'}}>{l}</p><p className="text-xl font-bold">{v}</p><p className="text-xs" style={{color:'#94a3b8'}}>{s}</p></div>
          ))}
        </div>
      </Section>
    </div>
  )
}
