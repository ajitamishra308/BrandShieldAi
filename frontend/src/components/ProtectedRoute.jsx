import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { Button, Spinner } from './ui.jsx'

export default function ProtectedRoute() {
  const { session, profile, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading..." />
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />

  if (!profile) {
    return (
      <div className="mx-auto mt-24 max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold">This account has no role yet</h1>
        <p className="mt-2 text-sm text-slate-600">
          Ask an administrator to add your account to the profiles table, then sign in again.
        </p>
        <Button variant="secondary" className="mt-4" onClick={signOut}>Sign out</Button>
      </div>
    )
  }
  return <Outlet />
}
