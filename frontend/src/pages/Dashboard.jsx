import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { supabase } from '../lib/supabase.js'
import { Card, Spinner } from '../components/ui.jsx'
import ServiceStatus from '../components/ServiceStatus.jsx'

function Stat({ label, value, to }) {
  const body = (
    <Card className={to ? 'transition hover:border-brand' : ''}>
      <p className="text-3xl font-bold tracking-tight">{value ?? '-'}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </Card>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

const count = (table, filter) => {
  let query = supabase.from(table).select('*', { count: 'exact', head: true })
  if (filter) query = filter(query)
  return query
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      count('facts'),
      count('brand_rules', (q) => q.eq('active', true)),
      count('content_items'),
      count('content_items', (q) => q.eq('status', 'in_review')),
      count('findings', (q) => q.eq('decision', 'open').eq('severity', 'high').neq('status', 'verified')),
    ]).then((results) => {
      if (!active) return
      const failed = results.find((r) => r.error)
      if (failed) setError(failed.error.message)
      setStats({ facts: results[0].count, rules: results[1].count, items: results[2].count, pending: results[3].count, high: results[4].count })
    })
    return () => { active = false }
  }, [])

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome, {profile?.full_name}</h1>
        <p className="text-sm text-slate-500">Check content against approved brand rules and facts before it is published.</p>
      </div>

      {error && <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger" role="alert">Could not read the database: {error}</p>}

      {!stats ? (
        <Spinner label="Loading overview..." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Approved facts" value={stats.facts} to="/brand-kit" />
          <Stat label="Active brand rules" value={stats.rules} to="/brand-kit" />
          <Stat label="Content items" value={stats.items} to="/campaigns" />
          <Stat label="Waiting for approval" value={stats.pending} to="/approvals" />
          <Stat label="High-priority findings open" value={stats.high} to="/campaigns" />
        </div>
      )}

      <Card title="Try the main journey (about 3 minutes)">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li>As <strong>creator</strong>, open <Link className="text-brand-dark underline" to="/campaigns">Campaigns</Link> and choose "FreshJuice Festive Launch".</li>
          <li>Press <strong>Run review on all items</strong>. Each finding shows why it was raised, the rule or approved fact behind it, and a suggested fix.</li>
          <li>Open "Instagram launch post". <strong>Apply fix and accept</strong> or <strong>Dismiss</strong> (with a reason) each high-priority finding, save the new version, and run the review again.</li>
          <li>When no high-priority finding is open, press <strong>Send for approval</strong>.</li>
          <li>Use "Demo: view as" in the sidebar to become <strong>manager</strong>, open <Link className="text-brand-dark underline" to="/approvals">Approvals</Link>, comment, and approve or request changes.</li>
          <li>As <strong>admin</strong>, change a fact in the <Link className="text-brand-dark underline" to="/brand-kit">Brand kit</Link>, then see the affected content in the <Link className="text-brand-dark underline" to="/impact">Impact view</Link>.</li>
        </ol>
      </Card>

      <Card title="System status">
        <ServiceStatus />
      </Card>
    </div>
  )
}
