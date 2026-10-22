import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import { isConfigured } from '../lib/supabase.js'
import { DEMO_PASSWORD, DEMO_USERS } from '../lib/demo.js'
import { Badge, Button, Card } from '../components/ui.jsx'

export default function Login() {
  const { session, profile, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (session && profile) return <Navigate to="/" replace />

  async function attempt(nextEmail, nextPassword) {
    setBusy(true)
    setError('')
    const { error: signInError } = await signIn(nextEmail, nextPassword)
    if (signInError) setError(signInError.message)
    setBusy(false)
  }

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col justify-center gap-8 px-4 py-10 md:flex-row md:items-center">
      <div className="md:w-1/2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-8 w-8 text-brand" aria-hidden="true" />
          <h1 className="text-3xl font-bold tracking-tight">BrandShield AI</h1>
        </div>
        <p className="mt-3 text-lg text-slate-600">
          Check content against approved brand guidelines and facts before it is published.
        </p>
        <ul className="mt-4 space-y-1 text-sm text-slate-600">
          <li>Every finding cites the rule or approved fact behind it.</li>
          <li>Suggested fixes keep the writer's purpose; people make the final decision.</li>
          <li>Reviews, comments and approvals are recorded.</li>
        </ul>
      </div>

      <div className="space-y-4 md:w-1/2">
        {!isConfigured && (
          <p className="rounded-lg bg-warn-soft p-3 text-sm text-warn" role="alert">
            The app is not connected to a database yet. Fill in <code>frontend/.env</code> (see <code>.env.example</code>) and restart.
          </p>
        )}

        <Card title="Try it with a demo account (one click)">
          <div className="grid gap-2 sm:grid-cols-2">
            {DEMO_USERS.map((demo) => (
              <button
                key={demo.role}
                disabled={busy || !isConfigured}
                onClick={() => attempt(demo.email, DEMO_PASSWORD)}
                className="rounded-lg border border-slate-200 p-3 text-left transition hover:border-brand hover:bg-brand-soft disabled:opacity-60"
              >
                <Badge tone="brand">{demo.role}</Badge>
                <p className="mt-1 text-xs text-slate-600">{demo.blurb}</p>
              </button>
            ))}
          </div>
        </Card>

        <Card title="Or sign in with your account">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              attempt(email, password)
            }}
            className="space-y-3"
          >
            <label className="block text-sm">
              <span className="text-slate-600">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">Password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </label>
            {error && <p className="text-sm text-danger" role="alert">{error}</p>}
            <Button type="submit" disabled={busy || !isConfigured} className="w-full">
              {busy ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
