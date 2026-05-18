'use client'
import { useState }        from 'react'
import { useRouter }        from 'next/navigation'
import Link                 from 'next/link'
import { createClient }     from '@/lib/supabase/client'
import { Button }           from '@/components/ui/button'
import { Input }            from '@/components/ui/input'
import { Label }            from '@/components/ui/label'
import { toast }            from 'sonner'
import { Loader2, Mail, Lock, Building2 } from 'lucide-react'

export default function LoginPage() {
  const router  = useRouter()
  const sb      = createClient()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [msLoading,setMsLoading]= useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await sb.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message === 'Invalid login credentials'
        ? 'Incorrect email or password. Please try again.'
        : error.message)
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  async function handleMicrosoft() {
    setMsLoading(true)
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes:      'email profile',
        redirectTo:  `${window.location.origin}/api/auth/callback`,
      },
    })
    if (error) { toast.error(error.message); setMsLoading(false) }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-2xl border border-border bg-white p-8 shadow-xl shadow-slate-200/60">

        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-foreground">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your BankFlow account</p>
        </div>

        {/* Microsoft SSO */}
        <Button
          type="button"
          variant="outline"
          className="mb-4 w-full gap-3 border-slate-200 text-sm font-medium"
          onClick={handleMicrosoft}
          disabled={msLoading}
        >
          {msLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <svg className="h-4 w-4" viewBox="0 0 21 21">
              <rect x="0"  y="0"  width="9.5" height="9.5" fill="#f25022"/>
              <rect x="11" y="0"  width="9.5" height="9.5" fill="#7fba00"/>
              <rect x="0"  y="11" width="9.5" height="9.5" fill="#00a4ef"/>
              <rect x="11" y="11" width="9.5" height="9.5" fill="#ffb900"/>
            </svg>
          )}
          Continue with Microsoft
        </Button>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-muted-foreground">or email</span>
          </div>
        </div>

        {/* Email form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="email" type="email" placeholder="you@hudsonweir.co.uk"
                className="pl-9" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="password" type="password" placeholder="••••••••"
                className="pl-9" required autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          No account?{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Request access
          </Link>
        </p>
      </div>

      {/* Trust badges */}
      <div className="mt-6 flex items-center justify-center gap-5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> UK-based</span>
        <span>🔒 GDPR compliant</span>
        <span>🏛 Insolvency Act 1986</span>
      </div>
    </div>
  )
}
