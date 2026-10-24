import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { supabase } from '../lib/supabase.js'
import { factState, fmtDate, must } from '../lib/format.js'
import { SEVERITY_TONE } from '../lib/labels.js'
import { Badge, Button, Card, Field, Notice, Spinner, Tabs, inputClass } from '../components/ui.jsx'

const EMPTY_FACT = { id: '', fact_key: '', label: '', value: '', numeric_value: '', unit: 'text', source: '', owner: '', valid_until: '' }

export default function BrandKit() {
  const { profile } = useAuth()
  const isAdmin = profile.role === 'admin'
  const [tab, setTab] = useState('facts')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const [facts, rules, terms] = await Promise.all([
      supabase.from('facts').select('*').order('id'),
      supabase.from('brand_rules').select('*').order('id'),
      supabase.from('terminology').select('*').order('id'),
    ])
    const failed = [facts, rules, terms].find((r) => r.error)
    if (failed) { setError(failed.error.message); return }
    setData({ facts: facts.data, rules: rules.data, terms: terms.data })
  }, [])

  useEffect(() => { load() }, [load])

  async function run(fn, message) {
    setError('')
    setNotice('')
    try { await fn(); await load(); if (message) setNotice(message) } catch (e) { setError(e.message) }
  }

  if (!data) return error ? <Notice tone="danger">{error}</Notice> : <Spinner label="Loading brand kit..." />

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Brand kit</h1>
        <p className="text-sm text-slate-500">
          The approved sources every review is checked against. {isAdmin ? 'You are an admin, so you can change them.' : 'Only an admin can change them.'}
        </p>
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      {notice && <Notice tone="brand">{notice}</Notice>}

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'facts', label: `Approved facts (${data.facts.length})` },
          { value: 'rules', label: `Rules (${data.rules.length})` },
          { value: 'terms', label: `Banned terms (${data.terms.length})` },
        ]}
      />

      {tab === 'facts' && <Facts facts={data.facts} isAdmin={isAdmin} run={run} />}
      {tab === 'rules' && <Rules rules={data.rules} isAdmin={isAdmin} run={run} />}
      {tab === 'terms' && <Terms terms={data.terms} rules={data.rules} isAdmin={isAdmin} run={run} />}
    </div>
  )
}

function Facts({ facts, isAdmin, run }) {
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState({})
  const [adding, setAdding] = useState(false)
  const [fresh, setFresh] = useState(EMPTY_FACT)

  const toNumber = (v) => (v === '' || v === null ? null : Number(v))

  return (
    <div className="space-y-4">
      {facts.map((fact) => {
        const state = factState(fact)
        const isEditing = editing === fact.id
        return (
          <Card key={fact.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm text-slate-500">{fact.id} · {fact.label}</p>
                <p className="text-lg font-semibold">{fact.value}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Source: {fact.source} · Owner: {fact.owner} · Valid until: {fact.valid_until ? fmtDate(fact.valid_until) : 'no end date'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={state.tone}>{state.label}</Badge>
                {isAdmin && !isEditing && (
                  <Button variant="secondary" onClick={() => { setEditing(fact.id); setDraft({ value: fact.value, numeric_value: fact.numeric_value ?? '', owner: fact.owner, source: fact.source, valid_until: fact.valid_until ?? '' }) }}>Edit</Button>
                )}
              </div>
            </div>
            {isEditing && (
              <form
                className="mt-4 grid gap-3 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  run(async () => {
                    must(await supabase.from('facts').update({
                      value: draft.value, numeric_value: toNumber(draft.numeric_value), owner: draft.owner,
                      source: draft.source, valid_until: draft.valid_until || null,
                    }).eq('id', fact.id))
                    setEditing(null)
                  }, `${fact.id} updated. The Impact view now shows which content needs a new review.`)
                }}
              >
                <Field label="Value (as shown to people)"><input className={`mt-1 ${inputClass}`} value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} required /></Field>
                <Field label="Number used for matching" hint="Leave empty for text facts"><input type="number" step="any" className={`mt-1 ${inputClass}`} value={draft.numeric_value} onChange={(e) => setDraft({ ...draft, numeric_value: e.target.value })} /></Field>
                <Field label="Owner"><input className={`mt-1 ${inputClass}`} value={draft.owner} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} required /></Field>
                <Field label="Source"><input className={`mt-1 ${inputClass}`} value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} required /></Field>
                <Field label="Valid until"><input type="date" className={`mt-1 ${inputClass}`} value={draft.valid_until} onChange={(e) => setDraft({ ...draft, valid_until: e.target.value })} /></Field>
                <div className="flex items-end gap-2">
                  <Button type="submit">Save</Button>
                  <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                </div>
              </form>
            )}
          </Card>
        )
      })}

      {isAdmin && (
        <Card title="Add an approved fact">
          {!adding ? (
            <Button variant="secondary" onClick={() => setAdding(true)}>Add a fact</Button>
          ) : (
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault()
                run(async () => {
                  must(await supabase.from('facts').insert({
                    ...fresh, numeric_value: toNumber(fresh.numeric_value), valid_until: fresh.valid_until || null,
                  }))
                  setFresh(EMPTY_FACT)
                  setAdding(false)
                }, 'Fact added.')
              }}
            >
              <Field label="ID" hint="For example F-9"><input required className={`mt-1 ${inputClass}`} value={fresh.id} onChange={(e) => setFresh({ ...fresh, id: e.target.value })} /></Field>
              <Field label="Key" hint="No spaces, for example free_gift"><input required className={`mt-1 ${inputClass}`} value={fresh.fact_key} onChange={(e) => setFresh({ ...fresh, fact_key: e.target.value })} /></Field>
              <Field label="Name"><input required className={`mt-1 ${inputClass}`} value={fresh.label} onChange={(e) => setFresh({ ...fresh, label: e.target.value })} /></Field>
              <Field label="Value"><input required className={`mt-1 ${inputClass}`} value={fresh.value} onChange={(e) => setFresh({ ...fresh, value: e.target.value })} /></Field>
              <Field label="Number" hint="Only for numeric facts"><input type="number" step="any" className={`mt-1 ${inputClass}`} value={fresh.numeric_value} onChange={(e) => setFresh({ ...fresh, numeric_value: e.target.value })} /></Field>
              <Field label="Unit" hint="INR, percent, days, bottles, cities or text">
                <select className={`mt-1 ${inputClass}`} value={fresh.unit} onChange={(e) => setFresh({ ...fresh, unit: e.target.value })}>
                  {['text', 'INR', 'percent', 'days', 'bottles', 'cities'].map((u) => <option key={u}>{u}</option>)}
                </select>
              </Field>
              <Field label="Source"><input required className={`mt-1 ${inputClass}`} value={fresh.source} onChange={(e) => setFresh({ ...fresh, source: e.target.value })} /></Field>
              <Field label="Owner"><input required className={`mt-1 ${inputClass}`} value={fresh.owner} onChange={(e) => setFresh({ ...fresh, owner: e.target.value })} /></Field>
              <Field label="Valid until"><input type="date" className={`mt-1 ${inputClass}`} value={fresh.valid_until} onChange={(e) => setFresh({ ...fresh, valid_until: e.target.value })} /></Field>
              <div className="flex items-end gap-2">
                <Button type="submit">Add fact</Button>
                <Button type="button" variant="secondary" onClick={() => setAdding(false)}>Cancel</Button>
              </div>
            </form>
          )}
        </Card>
      )}
    </div>
  )
}

function Rules({ rules, isAdmin, run }) {
  return (
    <div className="space-y-3">
      {rules.map((rule) => (
        <Card key={rule.id}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{rule.id} · {rule.title}</p>
              <p className="mt-1 text-sm text-slate-600">{rule.body}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{rule.category}</Badge>
              <Badge tone={SEVERITY_TONE[rule.severity]}>{rule.severity}</Badge>
              <Badge tone={rule.active ? 'brand' : 'neutral'}>{rule.active ? 'Active' : 'Switched off'}</Badge>
              {isAdmin && (
                <Button
                  variant="secondary"
                  onClick={() => run(async () => must(await supabase.from('brand_rules').update({ active: !rule.active }).eq('id', rule.id)), `${rule.id} ${rule.active ? 'switched off' : 'switched on'}.`)}
                >
                  {rule.active ? 'Switch off' : 'Switch on'}
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}
      <p className="text-xs text-slate-500">Image and accessibility rules (G-8, G-9) are checked once image review is added in Round 3.</p>
    </div>
  )
}

function Terms({ terms, rules, isAdmin, run }) {
  const [fresh, setFresh] = useState({ banned_term: '', preferred_term: '', rule_id: '', note: '' })
  return (
    <div className="space-y-4">
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr><th className="py-2 pr-3">Banned</th><th className="pr-3">Use instead</th><th className="pr-3">Rule</th><th className="pr-3">Note</th>{isAdmin && <th />}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {terms.map((t) => (
                <tr key={t.id}>
                  <td className="py-2 pr-3 font-medium">{t.banned_term}</td>
                  <td className="pr-3">{t.preferred_term || 'rephrase'}</td>
                  <td className="pr-3">{t.rule_id || '-'}</td>
                  <td className="pr-3 text-slate-500">{t.note}</td>
                  {isAdmin && (
                    <td>
                      <Button variant="secondary" onClick={() => run(async () => must(await supabase.from('terminology').delete().eq('id', t.id)), 'Term removed.')}>Remove</Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {isAdmin && (
        <Card title="Add a banned term">
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              run(async () => {
                must(await supabase.from('terminology').insert({
                  banned_term: fresh.banned_term.trim(), preferred_term: fresh.preferred_term.trim() || null,
                  rule_id: fresh.rule_id || null, note: fresh.note.trim() || null,
                }))
                setFresh({ banned_term: '', preferred_term: '', rule_id: '', note: '' })
              }, 'Term added.')
            }}
          >
            <Field label="Banned word or phrase"><input required className={`mt-1 ${inputClass}`} value={fresh.banned_term} onChange={(e) => setFresh({ ...fresh, banned_term: e.target.value })} /></Field>
            <Field label="Use instead"><input className={`mt-1 ${inputClass}`} value={fresh.preferred_term} onChange={(e) => setFresh({ ...fresh, preferred_term: e.target.value })} /></Field>
            <Field label="Rule it comes from">
              <select className={`mt-1 ${inputClass}`} value={fresh.rule_id} onChange={(e) => setFresh({ ...fresh, rule_id: e.target.value })}>
                <option value="">None</option>
                {rules.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.title}</option>)}
              </select>
            </Field>
            <Field label="Note"><input className={`mt-1 ${inputClass}`} value={fresh.note} onChange={(e) => setFresh({ ...fresh, note: e.target.value })} /></Field>
            <div><Button type="submit">Add term</Button></div>
          </form>
        </Card>
      )}
    </div>
  )
}
