export function fmtDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Is an approved fact still valid? Returns a label and a colour for badges.
export function factState(fact, now = new Date()) {
  if (!fact.valid_until) return { key: 'valid', label: 'No end date', tone: 'brand', days: null }
  const end = new Date(`${fact.valid_until}T23:59:59`)
  const days = Math.ceil((end - now) / 86400000)
  if (end < now) return { key: 'expired', label: 'Expired', tone: 'danger', days }
  if (days <= 7) return { key: 'expiring', label: `Expires in ${days} day${days === 1 ? '' : 's'}`, tone: 'warn', days }
  return { key: 'valid', label: 'Valid', tone: 'brand', days }
}

export const must = (result) => {
  if (result.error) throw new Error(result.error.message)
  return result.data
}
