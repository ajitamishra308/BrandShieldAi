// Demo accounts so a judge can try each role with one click.
// They exist only in the demo database and hold no real data.
export const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD || 'Demo@12345'

export const DEMO_USERS = [
  { role: 'creator', email: 'creator@brandshield.demo', blurb: 'Writes drafts and sends them for approval' },
  { role: 'manager', email: 'manager@brandshield.demo', blurb: 'Reviews, comments and approves' },
  { role: 'reviewer', email: 'reviewer@brandshield.demo', blurb: 'Checks sensitive claims' },
  { role: 'admin', email: 'admin@brandshield.demo', blurb: 'Maintains rules and approved facts' },
]
