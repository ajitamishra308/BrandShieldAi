import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { supabase } from '../lib/supabase.js'
import { Card, Spinner } from '../components/ui.jsx'
import ServiceStatus from '../components/ServiceStatus.jsx'

function Stat({ label, value }) {
  return (
    <Card>
      <p className="text-3xl font-bold tracking-tight">{value ?? '-'}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </Card>
  )
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
      count('brand_rules'),
      count('content_items'),
      count('content_items', (q) => q.eq('status', 'in_review')),
    ]).then((results) => {
      if (!active) return
      const failed = results.find((r) => r.error)
      if (failed) setError(failed.error.message)
      setStats({
        facts: results[0].count,
        rules: results[1].count,
        items: results[2].count,
        pending: results[3].count,
      })
    })
    return () => { active = false }
  }, [])

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome, {profile?.full_name}</h1>
        <p className="text-sm text-slate-500">Overview of the brand knowledge base and review activity.</p>
      </div>

      {error && (
        <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger" role="alert">
          Could not read the database: {error}
        </p>
      )}

      {!stats ? (
        <Spinner label="Loading overview..." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Approved facts" value={stats.facts} />
          <Stat label="Brand rules" value={stats.rules} />
          <Stat label="Content items" value={stats.items} />
          <Stat label="Waiting for approval" value={stats.pending} />
        </div>
      )}

      <Card title="System status">
        <ServiceStatus />
      </Card>
    </div>
  )
}
