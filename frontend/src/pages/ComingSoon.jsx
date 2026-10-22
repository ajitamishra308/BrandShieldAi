import { Card } from '../components/ui.jsx'

export default function ComingSoon({ title, plan }) {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <Card>
        <p className="text-sm text-slate-600">This page is being built in the next steps of Round 2.</p>
        {plan && <p className="mt-2 text-sm text-slate-500">{plan}</p>}
      </Card>
    </div>
  )
}
