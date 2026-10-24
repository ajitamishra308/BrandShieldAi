import { useState } from 'react'
import { Badge, Button } from './ui.jsx'
import { fmtDateTime } from '../lib/format.js'

export default function Comments({ comments, onAdd, busy }) {
  const [text, setText] = useState('')

  return (
    <div className="space-y-3">
      {comments.length === 0 && <p className="text-sm text-slate-500">No comments yet.</p>}
      {comments.map((c) => (
        <div key={c.id} className="rounded-lg bg-slate-50 p-3">
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <strong className="text-slate-700">{c.author?.full_name}</strong>
            {c.author?.role && <Badge>{c.author.role}</Badge>}
            {fmtDateTime(c.created_at)}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{c.body}</p>
        </div>
      ))}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!text.trim()) return
          onAdd(text.trim())
          setText('')
        }}
        className="space-y-2"
      >
        <label className="sr-only" htmlFor="new-comment">Write a comment</label>
        <textarea
          id="new-comment"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Write a comment..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <Button type="submit" variant="secondary" disabled={busy || !text.trim()}>Add comment</Button>
      </form>
    </div>
  )
}
