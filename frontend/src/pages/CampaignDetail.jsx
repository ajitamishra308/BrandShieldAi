import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import { supabase } from '../lib/supabase.js'
import { reviewCampaign } from '../lib/api.js'
import { logAudit } from '../lib/audit.js'
import { must } from '../lib/format.js'
import { CHANNELS, CHANNEL_LABEL, ITEM_STATUS } from '../lib/labels.js'
import { Badge, Button, Card, Field, Notice, Spinner, inputClass } from '../components/ui.jsx'

export default function CampaignDetail() {
  const { id } = useParams()
  const { profile, token } = useAuth()
  const [campaign, setCampaign] = useState(null)
  const [items, setItems] = useState([])
  const [findings, setFindings] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [form, setForm] = useState({ title: '', channel: 'instagram', body: '' })

  const load = useCallback(async () => {
    const campaignResult = await supabase.from('campaigns').select('*').eq('id', id).single()
    if (campaignResult.error) { setError(campaignResult.error.message); return }
    const itemsResult = await supabase.from('content_items').select('*').eq('campaign_id', id).order('created_at')
    if (itemsResult.error) { setError(itemsResult.error.message); return }
    const ids = itemsResult.data.map((i) => i.id)
    let found = []
    if (ids.length) {
      const findingsResult = await supabase.from('findings').select('item_id, status, severity, decision').in('item_id', ids)
      if (findingsResult.error) { setError(findingsResult.error.message); return }
      found = findingsResult.data
    }
    setCampaign(campaignResult.data)
    setItems(itemsResult.data)
    setFindings(found)
  }, [id])

  useEffect(() => { load() }, [load])

  async function addItem(event) {
    event.preventDefault()
    setBusy('add')
    setError('')
    try {
      const created = must(await supabase.from('content_items').insert({
        campaign_id: id, title: form.title.trim(), channel: form.channel, body: form.body, created_by: profile.id,
      }).select().single())
      must(await supabase.from('content_versions').insert({
        item_id: created.id, version: 1, body: form.body, note: 'First draft', created_by: profile.id,
      }))
      await logAudit(profile.id, 'created', created.id, { title: created.title })
      setForm({ title: '', channel: 'instagram', body: '' })
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  async function reviewAll() {
    setBusy('review')
    setError('')
    setNotice('')
    try {
      const result = await reviewCampaign(id, token)
      const total = result.reviewed.reduce((sum, r) => sum + r.findings, 0)
      setNotice(`Reviewed ${result.reviewed.length} item(s): ${total} findings in total.`)
      await load()
    } catch (e) {
      setError(`The review could not run: ${e.message}`)
    } finally {
      setBusy('')
    }
  }

  if (error && !campaign) return <Notice tone="danger">{error}</Notice>
  if (!campaign) return <Spinner label="Loading campaign..." />

  const openOf = (itemId) => findings.filter((f) => f.item_id === itemId && f.decision === 'open' && f.status !== 'verified')
  const mismatches = findings.filter((f) => f.status === 'mismatch' && f.decision === 'open').length

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link to="/campaigns" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All campaigns
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{campaign.name}</h1>
      </div>

      {error && <Notice tone="danger">{error}</Notice>}
      {notice && <Notice tone="brand">{notice}</Notice>}
      {mismatches > 0 && (
        <Notice tone="warn">
          {mismatches} open cross-channel mismatch{mismatches === 1 ? '' : 'es'}: items of this campaign state different values for the same thing.
        </Notice>
      )}

      <Card
        title={`Content in this campaign (${items.length})`}
        action={
          <Button disabled={busy === 'review' || items.length === 0} onClick={reviewAll}>
            {busy === 'review' ? 'Reviewing...' : 'Run review on all items'}
          </Button>
        }
      >
        {busy === 'review' && (
          <p className="mb-3 text-sm text-slate-500">
            The first review after a pause can take up to a minute while the free server wakes up.
          </p>
        )}
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">No content yet. Add the first item below.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => {
              const open = openOf(item.id)
              const high = open.filter((f) => f.severity === 'high').length
              const status = ITEM_STATUS[item.status]
              return (
                <li key={item.id}>
                  <Link to={`/items/${item.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-slate-50">
                    <span>
                      <span className="font-medium">{item.title}</span>
                      <span className="ml-2 text-sm text-slate-500">{CHANNEL_LABEL[item.channel]} · version {item.version}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {open.length > 0 && <Badge tone={high ? 'danger' : 'warn'}>{open.length} to decide{high ? ` (${high} high)` : ''}</Badge>}
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card title="Add content">
        <form onSubmit={addItem} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title">
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`mt-1 ${inputClass}`} />
            </Field>
            <Field label="Channel">
              <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} className={`mt-1 ${inputClass}`}>
                {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Text">
            <textarea required rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className={`mt-1 ${inputClass}`} />
          </Field>
          <Button type="submit" disabled={busy === 'add' || !form.title.trim() || !form.body.trim()}>Add to campaign</Button>
        </form>
      </Card>
    </div>
  )
}
