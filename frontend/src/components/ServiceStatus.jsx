import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { getHealth } from '../lib/api.js'
import { Spinner } from './ui.jsx'

// Free hosting puts the review service to sleep when nobody uses it, so the first call can take up to a minute.
export default function ServiceStatus() {
  const [state, setState] = useState('checking') // checking | waking | ok | down
  const [info, setInfo] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    const wakeTimer = setTimeout(() => setState((s) => (s === 'checking' ? 'waking' : s)), 4000)
    const giveUpTimer = setTimeout(() => controller.abort(), 90000)

    getHealth(controller.signal)
      .then((data) => {
        setInfo(data)
        setState('ok')
      })
      .catch(() => setState('down'))
      .finally(() => {
        clearTimeout(wakeTimer)
        clearTimeout(giveUpTimer)
      })

    return () => {
      controller.abort()
      clearTimeout(wakeTimer)
      clearTimeout(giveUpTimer)
    }
  }, [])

  if (state === 'checking') return <Spinner label="Checking review service..." />
  if (state === 'waking') {
    return <Spinner label="Waking up the review service. Free hosting can take up to a minute the first time..." />
  }
  if (state === 'down') {
    return (
      <p className="flex items-start gap-2 text-sm text-danger">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        Review service is not reachable. Basic pages still work; reviews need this service.
      </p>
    )
  }
  return (
    <ul className="space-y-1 text-sm">
      <li className="flex items-center gap-2 text-slate-700">
        <CheckCircle2 className="h-4 w-4 text-brand" aria-hidden="true" /> Review service is running
      </li>
      <li className="flex items-center gap-2 text-slate-700">
        {info?.database === 'ok' ? (
          <CheckCircle2 className="h-4 w-4 text-brand" aria-hidden="true" />
        ) : (
          <XCircle className="h-4 w-4 text-danger" aria-hidden="true" />
        )}
        Service can reach the database
      </li>
      <li className="flex items-center gap-2 text-slate-700">
        {info?.ai_configured ? (
          <CheckCircle2 className="h-4 w-4 text-brand" aria-hidden="true" />
        ) : (
          <XCircle className="h-4 w-4 text-slate-400" aria-hidden="true" />
        )}
        AI model connected {info?.ai_configured ? '' : '(not yet, rule-based checks only)'}
      </li>
    </ul>
  )
}
