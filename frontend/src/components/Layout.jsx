import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useWeb3 } from '../context/Web3Context'
import { truncateAddress } from '../utils/helpers'
import { CHAIN_ID } from '../contracts/config'
import WalletConnectModal from './WalletConnectModal'

const NAV_ITEMS = [
  { section: 'Marketplace', links: [
    { to: '/marketplace',   icon: '🌿', label: 'Explore Market' },
    { to: '/transparency',  icon: '🔍', label: 'Transparency'   },
  ]},
  { section: 'Buyer Hub', links: [
    { to: '/buyer',         icon: '📊', label: 'Buyer Dashboard'},
    { to: '/portfolio',     icon: '💼', label: 'My Offsets'     },
  ]},
  { section: 'Seller Hub', links: [
    { to: '/seller',                  icon: '🏭', label: 'Seller Dashboard' },
    { to: '/seller/register-project', icon: '📝', label: 'Register Project' },
    { to: '/seller/listings',         icon: '📋', label: 'My Listings'     },
  ]},
  { section: 'Governance', links: [
    { to: '/admin',         icon: '⚙️', label: 'Verifier / Admin' },
  ]},
]

export default function Layout() {
  const { isConnected, address, chainId, roles, disconnect, switchNetwork, connect, connectDemo } = useWeb3()
  const navigate = useNavigate()
  const location = useLocation()

  const networkName = chainId === 11155111 ? 'Sepolia'
                    : chainId === 31337    ? 'Localhost'
                    : chainId === 1        ? 'Ethereum Mainnet'
                    : chainId ? `Chain ${chainId}` : 'Unknown'
  const isWrongNetwork = isConnected && chainId !== CHAIN_ID && chainId !== 31337 && chainId !== 11155111

  return (
    <div className="app-layout">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <div className="sidebar-logo-icon">🌱</div>
          <span className="sidebar-logo-text">CarbonX</span>
        </div>

        {/* Quick Role Switcher Buttons */}
        <div style={{ padding: '0.85rem 0.85rem 0.25rem' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem',
            background: 'rgba(255,255,255,0.04)', padding: '0.25rem',
            borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)'
          }}>
            <button
              className={`btn btn-xs ${location.pathname.startsWith('/buyer') || location.pathname.startsWith('/portfolio') || location.pathname === '/marketplace' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ border: 'none', fontSize: '.75rem', padding: '.45rem .2rem' }}
              onClick={() => navigate('/buyer')}
            >
              🛒 Buyer
            </button>
            <button
              className={`btn btn-xs ${location.pathname.startsWith('/seller') ? 'btn-primary' : 'btn-ghost'}`}
              style={{ border: 'none', fontSize: '.75rem', padding: '.45rem .2rem' }}
              onClick={() => navigate('/seller')}
            >
              🏭 Seller
            </button>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(section => (
            <div key={section.section}>
              <div className="sidebar-section-label">{section.section}</div>
              {section.links.map(link => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                >
                  <span className="sidebar-link-icon">{link.icon}</span>
                  {link.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          {/* Role badges */}
          {isConnected && (
            <div className="flex gap-2 mb-3" style={{ flexWrap: 'wrap' }}>
              {roles.isAdmin    && <span className="badge badge-blue">Admin</span>}
              {roles.isVerifier && <span className="badge badge-yellow">Verifier</span>}
              {roles.isSeller   && <span className="badge badge-green">Seller</span>}
              {!roles.isAdmin && !roles.isVerifier && !roles.isSeller &&
                <span className="badge badge-muted">Buyer</span>}
            </div>
          )}
          {/* Network */}
          {isConnected && (
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: isWrongNetwork ? '#ef4444' : '#22c55e',
                  flexShrink: 0
                }}/>
                <span className="text-xs text-faint">{networkName}</span>
              </div>
              {isWrongNetwork && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '.7rem', padding: '.15rem .45rem', color: '#f87171' }}
                  onClick={() => switchNetwork(11155111)}
                >
                  Switch
                </button>
              )}
            </div>
          )}
          {/* Wallet */}
          {isConnected ? (
            <div>
              <div className="text-xs font-mono mb-2 truncate" style={{ color: 'var(--text-muted)' }}>{address}</div>
              <button className="btn btn-ghost btn-sm w-full" onClick={disconnect}>
                Disconnect
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button className="btn btn-primary w-full btn-sm" onClick={connect}>
                🦊 Connect MetaMask
              </button>
              <button className="btn btn-ghost w-full btn-xs text-faint" onClick={connectDemo}>
                ⚡ Instant Demo Mode
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────── */}
      <div className="main-content">
        {/* Top Navbar */}
        <header className="navbar">
          <div />
          <div className="flex items-center gap-3">
            {isWrongNetwork && (
              <button
                className="badge badge-red"
                style={{ cursor: 'pointer', border: 'none', padding: '.3rem .6rem' }}
                onClick={() => switchNetwork(11155111)}
                title="Click to switch MetaMask to Sepolia Testnet"
              >
                Wrong Network (Switch to Sepolia)
              </button>
            )}
            {isConnected ? (
              <div className="flex items-center gap-2">
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#22c55e', boxShadow: '0 0 6px #22c55e'
                }}/>
                <span className="text-sm text-muted font-mono">
                  {truncateAddress(address)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button className="btn btn-ghost btn-sm" onClick={connectDemo} title="Login instantly for demo">
                  ⚡ Demo Mode
                </button>
                <button className="btn btn-primary btn-sm" onClick={connect}>
                  🦊 Connect Wallet
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
