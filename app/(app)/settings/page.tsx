'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient }  from '@/lib/supabase/client'
import { Button }        from '@/components/ui/button'
import { Input }         from '@/components/ui/input'
import { Label }         from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast }         from 'sonner'
import { Upload, Building2, User, Shield, CreditCard } from 'lucide-react'

export default function SettingsPage() {
  const sb          = createClient()
  const logoRef     = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState({ full_name:'', company_name:'', email:'' })
  const [logo,    setLogo]    = useState<string|null>(null)
  const [saving,  setSaving]  = useState(false)
  const [uploading,setUploading] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return
      setProfile({ full_name: user.user_metadata.full_name||'', company_name: user.user_metadata.company_name||'', email: user.email||'' })
      const res  = await fetch('/api/logo')
      const data = await res.json()
      if (data.logo_url) setLogo(data.logo_url)
    }
    load()
  }, [])

  async function saveProfile() {
    setSaving(true)
    const { error } = await sb.auth.updateUser({ data: { full_name: profile.full_name, company_name: profile.company_name } })
    if (error) toast.error(error.message)
    else toast.success('Profile saved')
    setSaving(false)
  }

  async function uploadLogo(file: File) {
    setUploading(true)
    const form = new FormData(); form.append('logo', file)
    const res  = await fetch('/api/logo', { method:'POST', body:form })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error); setUploading(false); return }
    setLogo(data.logo_url)
    toast.success('Logo uploaded — will appear in Excel exports')
    setUploading(false)
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">Manage your profile, branding and plan</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-4 w-4"/>Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input value={profile.full_name} onChange={e=>setProfile(p=>({...p,full_name:e.target.value}))} placeholder="Jane Smith"/>
            </div>
            <div className="space-y-1.5">
              <Label>Firm name</Label>
              <Input value={profile.company_name} onChange={e=>setProfile(p=>({...p,company_name:e.target.value}))} placeholder="Hudson Weir Ltd"/>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={profile.email} disabled className="bg-muted/40"/>
          </div>
          <Button size="sm" onClick={saveProfile} disabled={saving}>{saving?'Saving…':'Save profile'}</Button>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4"/>Export Branding</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Your company logo will appear in Excel export headers.</p>
          {logo && <img src={logo} alt="Company logo" className="h-12 rounded border border-border p-1 object-contain"/>}
          <div>
            <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
              onChange={e => { const f=e.target.files?.[0]; if(f) uploadLogo(f) }}/>
            <Button variant="outline" size="sm" onClick={()=>logoRef.current?.click()} disabled={uploading}>
              <Upload className="h-4 w-4"/> {uploading?'Uploading…':logo?'Replace logo':'Upload logo'}
            </Button>
            <p className="mt-1.5 text-xs text-muted-foreground">PNG, JPG or SVG · Max 2MB · Will be resized to 200×80px</p>
          </div>
        </CardContent>
      </Card>

      {/* Plan */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4"/>Plan & Usage</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-green-800">Pro Plan</p>
              <p className="text-xs text-green-700">Unlimited statements · Learning engine · Priority support</p>
            </div>
            <span className="rounded-full bg-green-200 px-3 py-1 text-xs font-bold text-green-800">Active</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[['Statements','142','this month'],['Pages','1,847','processed'],['Dictionary','847','entries']].map(([l,v,s])=>(
              <div key={l} className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">{l}</p>
                <p className="text-xl font-bold">{v}</p>
                <p className="text-xs text-muted-foreground">{s}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4"/>Security</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Change password</p>
              <p className="text-xs text-muted-foreground">Send a password reset link to your email</p>
            </div>
            <Button variant="outline" size="sm" onClick={async()=>{
              await sb.auth.resetPasswordForEmail(profile.email)
              toast.success('Reset link sent to your email')
            }}>Send link</Button>
          </div>
          <hr className="border-border"/>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">Delete account</p>
              <p className="text-xs text-muted-foreground">Permanently delete all your data</p>
            </div>
            <Button variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50"
              onClick={()=>toast.error('Please contact support to delete your account.')}>Delete</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
