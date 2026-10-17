import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useWeb3 } from './context/Web3Context'
import Layout from './components/Layout'
import WalletConnectModal from './components/WalletConnectModal'
import LandingPage from './pages/LandingPage'
import SellerDashboard from './pages/seller/SellerDashboard'
import RegisterProject from './pages/seller/RegisterProject'
import ManageListings from './pages/seller/ManageListings'
import BuyerDashboard from './pages/buyer/BuyerDashboard'
import Marketplace from './pages/buyer/Marketplace'
import Portfolio from './pages/buyer/Portfolio'
import AdminDashboard from './pages/admin/AdminDashboard'
import TransparencyPage from './pages/TransparencyPage'
import ProjectDetail from './pages/ProjectDetail'

function ProtectedRoute({ children, requireRole }) {
  const { isConnected, roles } = useWeb3()
  if (!isConnected) return <Navigate to="/" replace />
  if (requireRole === 'seller'   && !roles.isSeller   && !roles.isAdmin) return <Navigate to="/" replace />
  if (requireRole === 'verifier' && !roles.isVerifier && !roles.isAdmin) return <Navigate to="/" replace />
  if (requireRole === 'admin'    && !roles.isAdmin)                       return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <>

      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<Layout />}>
          {/* Public */}
          <Route path="/transparency" element={<TransparencyPage />} />
          <Route path="/project/:id"  element={<ProjectDetail />} />

          {/* Buyer */}
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/portfolio"   element={<Portfolio />} />
          <Route path="/buyer"       element={<BuyerDashboard />} />

          {/* Seller */}
          <Route path="/seller"                  element={<SellerDashboard />} />
          <Route path="/seller/register-project" element={<RegisterProject />} />
          <Route path="/seller/listings"         element={<ManageListings />} />

          {/* Admin / Verifier */}
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
