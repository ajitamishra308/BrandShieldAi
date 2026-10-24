import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { supabase } from '../lib/supabase.js'
import { reviewItem } from '../lib/api.js'
import { factState, fmtDate, fmtDateTime } from '../lib/format.js'
import { CHANNEL_LABEL, ITEM_STATUS } from '../lib/labels.js'
import { Badge, Button, Card, Notice, Spinner } from '../components/ui.jsx'

export default function Impact() {
  const { token } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    const [facts, links] = await Promise.all([
      supabase.from('facts').select('*').order('id'),
      supabase.from('item_fact_links').select('fact_id, item:content_items(id, title, channel, status, version, last_reviewed_at)'),
    ])
    const failed = [facts, links].find((r) => r.error)
    if (failed) { setError(failed.error.message); return }
    setData({ facts: facts.data, links: links.data })
  }, [])

  useEffect(() => { load() }, [load])

  async function reReview(itemId) {
    setBusy(itemId)
    setError('')
    try { await reviewItem(itemId, token); await load() } catch (e) { setError(e.message) } finally { setBusy('') }
  }

  if (!data) return error ? <Notice tone="danger">{error}</Notice> : <Spinner label="Loading impact view..." />

  // Content is stale if the fact changed after the content was last reviewed.
  const rows = data.facts.map((fact) => {
    const used = data.links.filter((l) => l.fact_id === fact.id && l.item).map((l) => l.item)
    const stale = (item) => !item.last_reviewed_at || new Date(fact.updated_at) > new Date(item.last_reviewed_at)
    return { fact, state: factState(fact), used, stale }
  })
  const staleCount = rows.reduce((sum, r) => sum + r.used.filter(r.stale).length, 0)
  const expiredCount = rows.filter((r) => r.state.key === 'expired' && r.used.length > 0).length
  const parts = []
  if (staleCount > 0) parts.push(`${staleCount} item${staleCount === 1 ? ' needs' : 's need'} a new review because a fact changed after the last review`)
  if (expiredCount > 0) parts.push(`${expiredCount} fact${expiredCount === 1 ? '' : 's'} used in content ${expiredCount === 1 ? 'has' : 'have'} expired`)
  const message = parts.length ? `${parts.join('; ')}.` : ''

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Impact view</h1>
        <p className="text-sm text-slate-500">
          Which content depends on which approved fact. When a fact changes or expires, the content that uses it needs a new review.
        </p>
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      {message ? <Notice tone="warn">{message}</Notice> : <Notice tone="brand">All reviewed content is up to date with the approved facts.</Notice>}

      {rows.map(({ fact, state, used, stale }) => (
        <Card key={fact.id}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{fact.id} · {fact.label}: {fact.value}</p>
              <p className="text-xs text-slate-500">
                Owner: {fact.owner} · Valid until {fact.valid_until ? fmtDate(fact.valid_until) : 'no end date'} · Last changed {fmtDateTime(fact.updated_at)}
              </p>
            </div>
            <Badge tone={state.tone}>{state.label}</Badge>
          </div>
          {used.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No reviewed content uses this fact yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {used.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link to={`/items/${item.id}`} className="text-sm hover:underline">
                    <span className="font-medium">{item.title}</span>
                    <span className="ml-2 text-slate-500">{CHANNEL_LABEL[item.channel]} · {ITEM_STATUS[item.status].label}</span>
                  </Link>
                  <span className="flex items-center gap-2">
                    {stale(item) ? <Badge tone="warn">Needs a new review</Badge> : <Badge tone="brand">Up to date</Badge>}
                    {stale(item) && (
                      <Button variant="secondary" disabled={busy === item.id} onClick={() => reReview(item.id)}>
                        {busy === item.id ? 'Reviewing...' : 'Review again'}
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
    </div>
  )
}
