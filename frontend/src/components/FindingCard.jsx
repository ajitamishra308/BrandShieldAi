import { useState } from 'react'
import { Badge, Button } from './ui.jsx'
import { FINDING_STATUS, SEVERITY_TONE } from '../lib/labels.js'

// One finding: what was found, why, which rule or fact it comes from, and a suggested fix.
export default function FindingCard({ finding, source, canDecide, canApply, busy, onAccept, onDismiss, onApply }) {
  const [dismissing, setDismissing] = useState(false)
  const [reason, setReason] = useState('')
  const status = FINDING_STATUS[finding.status] || { label: finding.status, tone: 'neutral' }
  const open = finding.decision === 'open' && finding.status !== 'verified'
  const hasFix = finding.suggested_fix !== null && finding.suggested_fix !== undefined

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={status.tone}>{status.label}</Badge>
        {finding.status !== 'verified' && <Badge tone={SEVERITY_TONE[finding.severity]}>{finding.severity} priority</Badge>}
        {finding.decision !== 'open' && (
          <Badge tone={finding.decision === 'accepted' ? 'brand' : 'neutral'}>{finding.decision}</Badge>
        )}
      </div>

      <p className="mt-2 text-sm">
        <span className="text-slate-500">Text in the draft: </span>
        <mark className="rounded bg-warn-soft px-1 font-medium text-ink">{finding.claim}</mark>
      </p>
      <p className="mt-1 text-sm text-slate-700">{finding.explanation}</p>

      {source && (
        <p className="mt-2 rounded-md bg-slate-50 p-2 text-xs text-slate-600">
          <strong>Source {source.id}</strong>: {source.title}. {source.detail}
        </p>
      )}

      {hasFix && (
        <p className="mt-2 text-sm">
          <span className="text-slate-500">Suggested fix: </span>
          {finding.suggested_fix === '' ? (
            <span className="font-medium">remove this text</span>
          ) : (
            <span className="rounded bg-brand-soft px-1 font-medium text-brand-dark">{finding.suggested_fix}</span>
          )}
        </p>
      )}

      {finding.decision === 'dismissed' && finding.decision_reason && (
        <p className="mt-2 text-xs text-slate-500">Reason for dismissing: {finding.decision_reason}</p>
      )}

      {open && canDecide && !dismissing && (
        <div className="mt-3 flex flex-wrap gap-2">
          {hasFix && canApply && (
            <Button disabled={busy} onClick={onApply}>Apply fix and accept</Button>
          )}
          <Button variant="secondary" disabled={busy} onClick={onAccept}>Accept</Button>
          <Button variant="secondary" disabled={busy} onClick={() => setDismissing(true)}>Dismiss...</Button>
        </div>
      )}

      {open && canDecide && dismissing && (
        <div className="mt-3 space-y-2">
          <label className="block text-sm text-slate-700" htmlFor={`reason-${finding.id}`}>Why are you dismissing this?</label>
          <input
            id={`reason-${finding.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="A short reason is required"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <div className="flex gap-2">
            <Button
              disabled={busy || reason.trim().length < 3}
              onClick={() => { onDismiss(reason.trim()); setDismissing(false); setReason('') }}
            >
              Confirm dismiss
            </Button>
            <Button variant="secondary" onClick={() => setDismissing(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </article>
  )
}
