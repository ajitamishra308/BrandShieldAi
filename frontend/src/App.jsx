import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Approvals from './pages/Approvals.jsx'
import BrandKit from './pages/BrandKit.jsx'
import CampaignDetail from './pages/CampaignDetail.jsx'
import Campaigns from './pages/Campaigns.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Impact from './pages/Impact.jsx'
import ItemPage from './pages/ItemPage.jsx'
import Login from './pages/Login.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaigns/:id" element={<CampaignDetail />} />
          <Route path="/items/:id" element={<ItemPage />} />
          <Route path="/brand-kit" element={<BrandKit />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/impact" element={<Impact />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
