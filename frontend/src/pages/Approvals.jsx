import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { fmtDateTime } from '../lib/format.js'
import { CHANNEL_LABEL, ITEM_STATUS } from '../lib/labels.js'
import { Badge, Card, Notice, Spinner } from '../components/ui.jsx'

const SECTIONS = [
  { status: 'in_review', title: 'Waiting for approval', empty: 'Nothing is waiting for approval.' },
  { status: 'changes_requested', title: 'Changes requested', empty: 'No item needs changes.' },
  { status: 'approved', title: 'Approved', empty: 'Nothing has been approved yet.' },
]

export default function Approvals() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    supabase
      .from('content_items')
      .select('*, campaign:campaigns(name), author:profiles(full_name)')
      .in('status', SECTIONS.map((s) => s.status))
      .order('updated_at', { ascending: false })
      .then((result) => {
        if (!active) return
        if (result.error) setError(result.error.message)
        setItems(result.data || [])
      })
    return () => { active = false }
  }, [])

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Approvals</h1>
        <p className="text-sm text-slate-500">Managers and reviewers open an item to read the findings, comment, and approve or request changes.</p>
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      {!items ? (
        <Spinner label="Loading..." />
      ) : (
        SECTIONS.map((section) => {
          const rows = items.filter((i) => i.status === section.status)
          return (
            <Card key={section.status} title={`${section.title} (${rows.length})`}>
              {rows.length === 0 ? (
                <p className="text-sm text-slate-500">{section.empty}</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {rows.map((item) => (
                    <li key={item.id}>
                      <Link to={`/items/${item.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-slate-50">
                        <span>
                          <span className="font-medium">{item.title}</span>
                          <span className="ml-2 text-sm text-slate-500">
                            {item.campaign?.name} · {CHANNEL_LABEL[item.channel]} · by {item.author?.full_name}
                          </span>
                        </span>
                        <span className="flex items-center gap-2 text-xs text-slate-500">
                          {fmtDateTime(item.updated_at)}
                          <Badge tone={ITEM_STATUS[item.status].tone}>version {item.version}</Badge>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )
        })
      )}
    </div>
  )
}
