import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { BookOpen, CheckSquare, FolderKanban, LayoutDashboard, LogOut, Menu, Network, ShieldCheck, X } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import { Badge } from './ui.jsx'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/campaigns', label: 'Campaigns', icon: FolderKanban },
  { to: '/brand-kit', label: 'Brand kit', icon: BookOpen },
  { to: '/approvals', label: 'Approvals', icon: CheckSquare },
  { to: '/impact', label: 'Impact view', icon: Network },
]

const ROLE_TONE = { creator: 'neutral', manager: 'brand', reviewer: 'warn', admin: 'danger' }

export default function Layout() {
  const { profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)

  const sidebar = (
    <nav className="flex h-full flex-col bg-ink text-slate-200" aria-label="Main">
      <div className="flex items-center gap-2 px-5 py-5 text-white">
        <ShieldCheck className="h-6 w-6 text-brand" aria-hidden="true" />
        <span className="text-lg font-semibold tracking-tight">BrandShield AI</span>
      </div>
      <ul className="flex-1 space-y-1 px-3">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-medium text-white">{profile?.full_name}</p>
        <div className="mt-1 flex items-center justify-between">
          <Badge tone={ROLE_TONE[profile?.role] || 'neutral'}>{profile?.role}</Badge>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Sign out
          </button>
        </div>
      </div>
    </nav>
  )

  return (
    <div className="flex h-full">
      {/* desktop sidebar */}
      <aside className="hidden w-60 shrink-0 md:block">{sidebar}</aside>

      {/* mobile sidebar */}
      {open && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="w-64">{sidebar}</div>
          <button className="flex-1 bg-black/40" aria-label="Close menu" onClick={() => setOpen(false)} />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="font-semibold">BrandShield AI</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
