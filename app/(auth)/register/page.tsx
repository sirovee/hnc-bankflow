'use client'
import { useState }    from 'react'
import { useRouter }   from 'next/navigation'
import Link            from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button }      from '@/components/ui/button'
import { Input }       from '@/components/ui/input'
import { Label }       from '@/components/ui/label'
import { toast }       from 'sonner'
import { Loader2, Mail, Lock, User, Building2 } from 'lucide-react'

export default function RegisterPage() {
  const router   = useRouter()
  const sb       = createClient()
  const [form, setForm] = useState({ name:'', company:'', email:'', password:'', confirm:'' })
  const [loading, setLoading] = useState(false)

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return }
    if (form.password.length < 8)       { toast.error('Password must be at least 8 characters'); return }

    setLoading(true)
    const { error } = await sb.auth.signUp({
      email:    form.email,
      password: form.password,
      options:  { data: { full_name: form.name, company_name: form.company } },
    })

    if (error) { toast.error(error.message); setLoading(false); return }

    toast.success('Account created! Check your email to confirm.')
    router.push('/login?registered=true')
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-2xl border border-border bg-white p-8 shadow-xl shadow-slate-200/60">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold">Create account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Start processing bank statements today</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input id="name" placeholder="Jane Smith" className="pl-9" required value={form.name} onChange={set('name')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="company">Firm name</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input id="company" placeholder="Hudson Weir Ltd" className="pl-9" value={form.company} onChange={set('company')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input id="email" type="email" placeholder="you@firm.co.uk" className="pl-9" required value={form.email} onChange={set('email')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input id="password" type="password" placeholder="Min 8 characters" className="pl-9" required value={form.password} onChange={set('password')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input id="confirm" type="password" placeholder="Repeat password" className="pl-9" required value={form.confirm} onChange={set('confirm')} />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Create account
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link>
        </p>
        <p className="mt-3 text-center text-[11px] text-muted-foreground/70">
          By creating an account you agree to our{' '}
          <Link href="/privacy" className="underline">Privacy Policy</Link> and{' '}
          <Link href="/terms" className="underline">Terms of Service</Link>
        </p>
      </div>
    </div>
  )
}
