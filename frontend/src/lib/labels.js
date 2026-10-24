export const ITEM_STATUS = {
  draft: { label: 'Draft', tone: 'neutral' },
  reviewed: { label: 'Reviewed', tone: 'brand' },
  in_review: { label: 'Waiting for approval', tone: 'warn' },
  changes_requested: { label: 'Changes requested', tone: 'danger' },
  approved: { label: 'Approved', tone: 'brand' },
}

export const FINDING_STATUS = {
  verified: { label: 'Verified', tone: 'brand' },
  contradicted: { label: 'Contradicts approved fact', tone: 'danger' },
  mismatch: { label: 'Campaign mismatch', tone: 'danger' },
  expired_fact: { label: 'Expired fact', tone: 'danger' },
  rule_violation: { label: 'Rule violation', tone: 'danger' },
  unsupported: { label: 'Unsupported claim', tone: 'warn' },
  needs_human: { label: 'Needs human check', tone: 'warn' },
}

export const SEVERITY_TONE = { high: 'danger', medium: 'warn', low: 'neutral' }
export const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 }

export const CHANNELS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'email', label: 'Email' },
  { value: 'website', label: 'Website' },
  { value: 'ad', label: 'Advertisement' },
  { value: 'blog', label: 'Blog' },
  { value: 'other', label: 'Other' },
]
export const CHANNEL_LABEL = Object.fromEntries(CHANNELS.map((c) => [c.value, c.label]))

// A sentence for each entry of the audit log (the history of an item).
export function describeAudit(entry) {
  const d = entry.details || {}
  switch (entry.action) {
    case 'created': return 'created this item'
    case 'version_saved': return `saved version ${d.version}`
    case 'reviewed': return `ran the review: ${d.findings} findings, ${d.open_high} high priority still open`
    case 'finding_decided': return `${d.decision} a finding on "${d.claim}"${d.reason ? ` (reason: ${d.reason})` : ''}`
    case 'sent_for_approval': return 'sent this item for approval'
    case 'approved': return `approved version ${d.version}${d.note ? `: ${d.note}` : ''}`
    case 'changes_requested': return `requested changes${d.note ? `: ${d.note}` : ''}`
    default: return entry.action
  }
}
