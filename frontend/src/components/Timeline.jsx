import { describeAudit } from '../lib/labels.js'
import { fmtDateTime } from '../lib/format.js'

export default function Timeline({ entries }) {
  if (!entries.length) return <p className="text-sm text-slate-500">No history yet.</p>
  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="border-l-2 border-slate-200 pl-3">
          <p className="text-sm text-slate-700">
            <strong>{entry.actor?.full_name || 'System'}</strong> {describeAudit(entry)}
          </p>
          <p className="text-xs text-slate-400">{fmtDateTime(entry.created_at)}</p>
        </li>
      ))}
    </ol>
  )
}
