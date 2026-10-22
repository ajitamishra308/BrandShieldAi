import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import ComingSoon from './pages/ComingSoon.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Login from './pages/Login.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route
            path="/campaigns"
            element={<ComingSoon title="Campaigns" plan="Create a campaign, add content for each channel, run a review and see findings with their sources." />}
          />
          <Route
            path="/brand-kit"
            element={<ComingSoon title="Brand kit" plan="Rules, approved facts (with owner and expiry date) and terminology." />}
          />
          <Route
            path="/approvals"
            element={<ComingSoon title="Approvals" plan="Review queue with comments, approve or request changes, and full history." />}
          />
          <Route
            path="/impact"
            element={<ComingSoon title="Impact view" plan="See which content uses a fact, and what is affected when a fact changes or expires." />}
          />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
