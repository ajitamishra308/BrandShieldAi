import { Loader2 } from 'lucide-react'

export function Card({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold text-slate-700">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

const TONES = {
  neutral: 'bg-slate-100 text-slate-700',
  brand: 'bg-brand-soft text-brand-dark',
  danger: 'bg-danger-soft text-danger',
  warn: 'bg-warn-soft text-warn',
}

export function Badge({ tone = 'neutral', children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  )
}

export function Button({ variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-brand text-white hover:bg-brand-dark',
    secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    danger: 'bg-danger text-white hover:opacity-90',
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]} ${className}`}
      {...props}
    />
  )
}

export function Spinner({ label }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {label}
    </span>
  )
}
