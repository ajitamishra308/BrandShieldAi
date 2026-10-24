import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FolderKanban } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import { supabase } from '../lib/supabase.js'
import { fmtDate, must } from '../lib/format.js'
import { Button, Card, Field, Notice, Spinner, inputClass } from '../components/ui.jsx'

export default function Campaigns() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    supabase
      .from('campaigns')
      .select('*, items:content_items(id, status)')
      .order('created_at', { ascending: false })
      .then((result) => {
        if (!active) return
        if (result.error) setError(result.error.message)
        setCampaigns(result.data || [])
      })
    return () => { active = false }
  }, [])

  async function create(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const created = must(await supabase.from('campaigns').insert({ name: name.trim(), created_by: profile.id }).select().single())
      navigate(`/campaigns/${created.id}`)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
        <p className="text-sm text-slate-500">A campaign groups the content for one launch across channels, so contradictions between channels can be found.</p>
      </div>

      {error && <Notice tone="danger">{error}</Notice>}

      <Card title="Start a new campaign">
        <form onSubmit={create} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Campaign name">
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Diwali offer" className={`mt-1 ${inputClass}`} />
            </Field>
          </div>
          <Button type="submit" disabled={busy || !name.trim()}>Create campaign</Button>
        </form>
      </Card>

      {!campaigns ? (
        <Spinner label="Loading campaigns..." />
      ) : campaigns.length === 0 ? (
        <Notice>No campaigns yet. Create the first one above.</Notice>
      ) : (
        <div className="grid gap-3">
          {campaigns.map((c) => {
            const waiting = c.items.filter((i) => i.status === 'in_review').length
            const approved = c.items.filter((i) => i.status === 'approved').length
            return (
              <Link key={c.id} to={`/campaigns/${c.id}`} className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand">
                <div className="flex items-center gap-3">
                  <FolderKanban className="h-5 w-5 text-brand" aria-hidden="true" />
                  <h2 className="font-semibold">{c.name}</h2>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {c.items.length} item{c.items.length === 1 ? '' : 's'} · {waiting} waiting for approval · {approved} approved · created {fmtDate(c.created_at)}
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
