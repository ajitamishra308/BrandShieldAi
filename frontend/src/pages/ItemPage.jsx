import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import { supabase } from '../lib/supabase.js'
import { reviewItem } from '../lib/api.js'
import { logAudit } from '../lib/audit.js'
import { fmtDate, must } from '../lib/format.js'
import { CHANNEL_LABEL, ITEM_STATUS, SEVERITY_ORDER } from '../lib/labels.js'
import { Badge, Button, Card, Notice, Spinner, inputClass } from '../components/ui.jsx'
import FindingCard from '../components/FindingCard.jsx'
import Timeline from '../components/Timeline.jsx'
import Comments from '../components/Comments.jsx'

const EDITABLE = ['draft', 'reviewed', 'changes_requested']

export default function ItemPage() {
  const { id } = useParams()
  const { profile, token } = useAuth()
  const [data, setData] = useState(null)
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')

  const load = useCallback(async (resetBody) => {
    const [item, findings, comments, history, rules, facts] = await Promise.all([
      supabase.from('content_items').select('*, campaign:campaigns(id, name), author:profiles(full_name)').eq('id', id).single(),
      supabase.from('findings').select('*').eq('item_id', id),
      supabase.from('comments').select('*, author:profiles(full_name, role)').eq('item_id', id).order('created_at'),
      supabase.from('audit_log').select('*, actor:profiles(full_name, role)').eq('entity', 'content_item').eq('entity_id', id).order('created_at', { ascending: false }),
      supabase.from('brand_rules').select('*'),
      supabase.from('facts').select('*'),
    ])
    const failed = [item, findings, comments, history, rules, facts].find((r) => r.error)
    if (failed) { setError(failed.error.message); return }
    setData({
      item: item.data,
      findings: findings.data.sort(
        (a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3) || a.claim.localeCompare(b.claim),
      ),
      comments: comments.data,
      history: history.data,
      rules: Object.fromEntries(rules.data.map((r) => [r.id, r])),
      facts: Object.fromEntries(facts.data.map((f) => [f.id, f])),
    })
    if (resetBody) setBody(item.data.body)
  }, [id])

  useEffect(() => { load(true) }, [load])

  // Runs an action with a busy flag and error handling.
  async function act(label, fn) {
    setBusy(label)
    setError('')
    setNotice('')
    try { await fn() } catch (e) { setError(e.message || String(e)) } finally { setBusy('') }
  }

  if (error && !data) return <Notice tone="danger">{error}</Notice>
  if (!data) return <Spinner label="Loading..." />

  const { item, findings, comments, history, rules, facts } = data
  const role = profile.role
  const isOwner = item.created_by === profile.id
  const editable = isOwner && EDITABLE.includes(item.status)
  const canApprove = ['manager', 'reviewer', 'admin'].includes(role) && item.status === 'in_review'
  const unsaved = body !== item.body

  const needsDecision = findings.filter((f) => f.decision === 'open' && f.status !== 'verified')
  const decided = findings.filter((f) => f.decision !== 'open' && f.status !== 'verified')
  const verified = findings.filter((f) => f.status === 'verified')
  const blockers = needsDecision.filter((f) => f.severity === 'high')
  const canSend = isOwner && item.status === 'reviewed' && blockers.length === 0 && !unsaved

  function sourceOf(f) {
    const id = f.source_id
    if (!id) return null
    if (facts[id]) {
      const x = facts[id]
      return { id, title: x.label, detail: `${x.value}. Source: ${x.source}. Owner: ${x.owner}.${x.valid_until ? ` Valid until ${fmtDate(x.valid_until)}.` : ''}` }
    }
    if (rules[id]) return { id, title: rules[id].title, detail: rules[id].body }
    if (id.startsWith('TERM-')) return { id, title: 'Banned-terms list', detail: 'Listed in the terminology table of the brand kit.' }
    if (id === 'campaign') return { id, title: 'Campaign consistency', detail: 'Compared with the other items of the same campaign.' }
    return null
  }

  const saveVersion = () => act('save', async () => {
    const next = item.version + 1
    must(await supabase.from('content_versions').insert({ item_id: id, version: next, body, note: `Edited by ${profile.full_name}`, created_by: profile.id }))
    must(await supabase.from('content_items').update({ body, version: next, status: 'draft' }).eq('id', id))
    await logAudit(profile.id, 'version_saved', id, { version: next })
    await load(true)
    setNotice(`Saved as version ${next}. Run the review to check this version.`)
  })

  const runReview = () => act('review', async () => {
    await reviewItem(id, token)
    await load(false)
    setNotice('Review finished. Decide on each finding below.')
  })

  const decide = (finding, decision, reason) => act('decide', async () => {
    must(await supabase.from('findings').update({
      decision, decision_reason: reason || null, decided_by: profile.id, decided_at: new Date().toISOString(),
    }).eq('id', finding.id))
    await logAudit(profile.id, 'finding_decided', id, { decision, claim: finding.claim, reason: reason || null })
    await load(false)
  })

  const applyFix = (finding) => {
    if (!body.includes(finding.claim)) {
      setNotice('That text is no longer in the draft, so there is nothing to replace.')
      return
    }
    setBody(body.replace(finding.claim, () => finding.suggested_fix))
    setNotice('Fix applied to the draft. Save it as a new version, then run the review again.')
    decide(finding, 'accepted', null)
  }

  const send = () => act('send', async () => {
    must(await supabase.from('content_items').update({ status: 'in_review' }).eq('id', id))
    await logAudit(profile.id, 'sent_for_approval', id, { version: item.version })
    await load(false)
    setNotice('Sent for approval.')
  })

  const decideApproval = (decision) => act('approve', async () => {
    if (decision === 'changes_requested' && !note.trim()) throw new Error('Please write what needs to change.')
    must(await supabase.from('approvals').insert({ item_id: id, version: item.version, reviewer_id: profile.id, decision, note: note.trim() || null }))
    must(await supabase.from('content_items').update({ status: decision === 'approved' ? 'approved' : 'changes_requested' }).eq('id', id))
    await logAudit(profile.id, decision, id, { version: item.version, note: note.trim() || null })
    setNote('')
    await load(false)
  })

  const addComment = (text) => act('comment', async () => {
    must(await supabase.from('comments').insert({ item_id: id, author_id: profile.id, body: text }))
    await load(false)
  })

  const status = ITEM_STATUS[item.status]

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <Link to={item.campaign ? `/campaigns/${item.campaign.id}` : '/campaigns'} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {item.campaign ? item.campaign.name : 'Campaigns'}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{item.title}</h1>
          <Badge tone={status.tone}>{status.label}</Badge>
          <Badge>{CHANNEL_LABEL[item.channel]}</Badge>
          <Badge>version {item.version}</Badge>
        </div>
        <p className="text-sm text-slate-500">By {item.author?.full_name}</p>
      </div>

      {error && <Notice tone="danger">{error}</Notice>}
      {notice && <Notice tone="brand">{notice}</Notice>}
      {item.status === 'changes_requested' && <Notice tone="warn">A reviewer asked for changes. See the comments and history, edit the text, and run the review again.</Notice>}

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Draft">
            <label className="sr-only" htmlFor="draft-body">Draft text</label>
            <textarea
              id="draft-body"
              rows={10}
              value={body}
              readOnly={!editable}
              onChange={(e) => setBody(e.target.value)}
              className={inputClass}
            />
            {!editable && <p className="mt-2 text-xs text-slate-500">{isOwner ? 'This version is locked while it waits for approval or after it is approved.' : 'Only the author can edit the text.'}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {editable && <Button variant="secondary" disabled={!unsaved || busy === 'save'} onClick={saveVersion}>Save as new version</Button>}
              <Button disabled={busy === 'review' || unsaved} onClick={runReview}>{busy === 'review' ? 'Reviewing...' : 'Run review'}</Button>
              {isOwner && <Button variant="secondary" disabled={!canSend || busy === 'send'} onClick={send}>Send for approval</Button>}
            </div>
            {busy === 'review' && <p className="mt-2 text-xs text-slate-500">The first review after a pause can take up to a minute while the free server wakes up.</p>}
            {unsaved && editable && <p className="mt-2 text-xs text-warn">You have unsaved changes. Save them as a new version before running the review.</p>}
            {isOwner && item.status === 'draft' && !unsaved && <p className="mt-2 text-xs text-slate-500">Run the review on this version, then send it for approval.</p>}
            {isOwner && item.status === 'reviewed' && blockers.length > 0 && (
              <p className="mt-2 text-xs text-warn">Decide on the {blockers.length} open high-priority finding{blockers.length === 1 ? '' : 's'} (accept the fix or dismiss with a reason) before sending for approval.</p>
            )}
          </Card>

          {canApprove && (
            <Card title="Your decision">
              <p className="mb-2 text-sm text-slate-600">
                {needsDecision.length} finding{needsDecision.length === 1 ? ' is' : 's are'} still open on this version.
              </p>
              <label className="sr-only" htmlFor="approval-note">Note</label>
              <textarea id="approval-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the author (required when requesting changes)" className={inputClass} />
              <div className="mt-3 flex gap-2">
                <Button disabled={busy === 'approve'} onClick={() => decideApproval('approved')}>Approve</Button>
                <Button variant="danger" disabled={busy === 'approve'} onClick={() => decideApproval('changes_requested')}>Request changes</Button>
              </div>
            </Card>
          )}

          <Card title="Comments"><Comments comments={comments} onAdd={addComment} busy={busy === 'comment'} /></Card>
          <Card title="History"><Timeline entries={history} /></Card>
        </div>

        <div className="space-y-5 lg:col-span-3">
          <Card title="Findings">
            {findings.length === 0 ? (
              <p className="text-sm text-slate-500">No review has been run on this version yet. Press "Run review".</p>
            ) : (
              <div className="space-y-5">
                <p className="text-sm text-slate-600">
                  {needsDecision.length} to decide · {decided.length} decided · {verified.length} verified against approved facts
                </p>
                {needsDecision.length > 0 && (
                  <section aria-label="Findings to decide" className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-700">Needs your decision</h3>
                    {needsDecision.map((f) => (
                      <FindingCard
                        key={f.id} finding={f} source={sourceOf(f)} busy={busy === 'decide'}
                        canDecide={isOwner || ['manager', 'reviewer', 'admin'].includes(role)}
                        canApply={editable && body.includes(f.claim)}
                        onAccept={() => decide(f, 'accepted', null)}
                        onDismiss={(reason) => decide(f, 'dismissed', reason)}
                        onApply={() => applyFix(f)}
                      />
                    ))}
                  </section>
                )}
                {decided.length > 0 && (
                  <section aria-label="Decided findings" className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-700">Decided</h3>
                    {decided.map((f) => <FindingCard key={f.id} finding={f} source={sourceOf(f)} />)}
                  </section>
                )}
                {verified.length > 0 && (
                  <section aria-label="Verified claims" className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-700">Verified against approved facts</h3>
                    {verified.map((f) => <FindingCard key={f.id} finding={f} source={sourceOf(f)} />)}
                  </section>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
