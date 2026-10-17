import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWeb3 } from '../context/Web3Context'
import WalletConnectModal from '../components/WalletConnectModal'

const STATS = [
  { value: '2.4M+', label: 'Credits Issued',   icon: '🌿' },
  { value: '180K+', label: 'Credits Retired',   icon: '♻️' },
  { value: '320+',  label: 'Active Projects',   icon: '📋' },
  { value: '$12M+', label: 'Total Traded',      icon: '💱' },
]

const FEATURES = [
  { icon: '🌳', title: 'Verified Projects',      desc: 'Forest, solar, wind, and hydro projects verified on-chain before any credits are minted.' },
  { icon: '🔗', title: 'Blockchain Transparency', desc: 'Every issuance, trade, and retirement is permanently recorded on the Ethereum blockchain.' },
  { icon: '💱', title: 'P2P Marketplace',         desc: 'Buy partial or full listings directly from verified sellers. No intermediaries.' },
  { icon: '📜', title: 'Offset Certificates',     desc: 'Retire credits and instantly download a verifiable PDF certificate with on-chain proof.' },
  { icon: '🔒', title: 'Smart Contract Security', desc: 'ReentrancyGuard, AccessControl, and input validation on all sensitive operations.' },
  { icon: '📊', title: 'Analytics Dashboard',     desc: 'Track your portfolio, earnings, and carbon offset progress with live charts.' },
]

const STEPS = [
  { step: '01', icon: '📝', title: 'Register a Project', desc: 'Sellers register forest, solar, or wind projects and upload IPFS verification documents.' },
  { step: '02', icon: '✅', title: 'Verifier Approves',  desc: 'A trusted verifier reviews the project and approves the number of credits to mint.' },
  { step: '03', icon: '🪙', title: 'Credits are Minted', desc: '1 CCT token = 1 ton CO₂ offset. Credits are minted as ERC-20 tokens to the seller.' },
  { step: '04', icon: '💱', title: 'Trade on Market',    desc: 'Sellers list credits; buyers purchase them in full or partially using ETH.' },
  { step: '05', icon: '📜', title: 'Retire & Certify',   desc: 'Buyers burn (retire) credits to claim an offset and download a PDF certificate.' },
]

export default function LandingPage() {
  const { isConnected, connect, roles } = useWeb3()
  const navigate = useNavigate()
  const [showWallet, setShowWallet] = useState(false)

  const handleCTA = () => {
    if (isConnected) {
      if (roles.isSeller || roles.isAdmin) navigate('/seller')
      else navigate('/marketplace')
    } else {
      setShowWallet(true)
    }
  }

  return (
    <div style={{ minHeight: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>

      {showWallet && <WalletConnectModal onClose={() => setShowWallet(false)} />}

      {/* ── Nav ────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: '66px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 2.5rem',
        background: 'rgba(12,12,15,0.88)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
        zIndex: 100,
      }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.3rem',
          background: 'var(--gradient-brand)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>🌱 CarbonX</div>

        <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/marketplace')}>Marketplace</button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/transparency')}>Transparency</button>
          <button className="btn btn-primary btn-sm" onClick={handleCTA}>
            {isConnected ? 'Open App →' : '🦊 Connect Wallet'}
          </button>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '6rem 2rem 4rem',
        position: 'relative',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 65%)',
      }}>
        {/* Glow blobs */}
        <div style={{
          position: 'absolute', top: '20%', left: '10%',
          width: 400, height: 400, borderRadius: '50%',
          background: 'rgba(99,102,241,0.05)',
          filter: 'blur(80px)', pointerEvents: 'none',
        }}/>
        <div style={{
          position: 'absolute', bottom: '15%', right: '8%',
          width: 300, height: 300, borderRadius: '50%',
          background: 'rgba(139,92,246,0.06)',
          filter: 'blur(80px)', pointerEvents: 'none',
        }}/>

        {/* Badge */}
        <div className="badge badge-blue" style={{ fontSize: '.78rem', padding: '.35rem 1rem', marginBottom: '1.5rem' }}>
          ⚡ Built on Ethereum · ERC-20 Carbon Credits
        </div>

        {/* Headline */}
        <h1 style={{
          maxWidth: '820px', marginBottom: '1.5rem',
          background: 'linear-gradient(135deg, #f1f1f3 0%, #a5b4fc 60%, #818cf8 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          lineHeight: 1.1,
        }}>
          Trade Carbon Credits.<br />Offset Your Impact.
        </h1>

        <p style={{
          maxWidth: '560px', fontSize: '1.1rem',
          color: 'var(--text-secondary)', marginBottom: '2.5rem', lineHeight: 1.75,
        }}>
          CarbonX is a decentralized platform where verified projects earn tokenized carbon credits,
          and businesses retire them to prove real-world CO₂ offsets — all on-chain.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '4rem' }}>
          <button className="btn btn-primary btn-xl" onClick={handleCTA}>
            {isConnected ? 'Open Dashboard →' : '🦊 Connect Wallet'}
          </button>
          <button className="btn btn-ghost btn-xl" onClick={() => navigate('/marketplace')}>
            Browse Marketplace
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {STATS.map(s => (
            <div key={s.label} className="stat-card" style={{ minWidth: '150px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '.4rem' }}>{s.icon}</div>
              <div className="stat-value" style={{ fontSize: '1.75rem' }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────── */}
      <section style={{ padding: '6rem 2.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <span className="badge badge-blue" style={{ marginBottom: '1rem', display: 'inline-flex' }}>
            Platform Features
          </span>
          <h2 style={{
            background: 'linear-gradient(135deg,#f1f1f3,#a5b4fc)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Everything you need to trade carbon credits
          </h2>
        </div>
        <div className="grid-3">
          {FEATURES.map(f => (
            <div key={f.title} className="card card-p card-glow" style={{ padding: '2rem' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: 'var(--accent-subtle)', border: '1px solid var(--border-accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.5rem', marginBottom: '1.25rem',
              }}>{f.icon}</div>
              <h4 style={{ marginBottom: '.6rem', color: 'var(--text-primary)' }}>{f.title}</h4>
              <p style={{ fontSize: '.88rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────── */}
      <section style={{
        padding: '6rem 2.5rem',
        background: 'linear-gradient(135deg,rgba(99,102,241,0.04),rgba(139,92,246,0.02))',
        borderTop: '1px solid var(--border-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <h2 style={{ background: 'linear-gradient(135deg,#f1f1f3,#a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            How CarbonX Works
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '1.25rem', maxWidth: '1100px', margin: '0 auto', flexWrap: 'wrap' }}>
          {STEPS.map((s, i) => (
            <div key={s.step} style={{ flex: 1, minWidth: '180px', position: 'relative' }}>
              {i < 4 && (
                <div style={{
                  position: 'absolute', top: '2rem', left: '100%', width: '1.25rem',
                  height: '2px', background: 'linear-gradient(90deg,var(--accent),transparent)',
                  zIndex: 0,
                }}/>
              )}
              <div className="card card-p" style={{ textAlign: 'center', padding: '1.5rem', position: 'relative', zIndex: 1 }}>
                <div style={{
                  fontSize: '.65rem', fontWeight: 700, color: 'var(--accent-light)',
                  letterSpacing: '.1em', marginBottom: '.75rem',
                }}>{s.step}</div>
                <div style={{ fontSize: '1.75rem', marginBottom: '.75rem' }}>{s.icon}</div>
                <h4 style={{ fontSize: '1rem', marginBottom: '.5rem' }}>{s.title}</h4>
                <p style={{ fontSize: '.82rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────── */}
      <section style={{ padding: '6rem 2.5rem', textAlign: 'center' }}>
        <div style={{
          maxWidth: '560px', margin: '0 auto',
          background: 'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.05))',
          border: '1px solid var(--border-accent)',
          borderRadius: 'var(--radius-xl)',
          padding: '3rem 2rem',
        }}>
          <h2 style={{ marginBottom: '1rem', background: 'linear-gradient(135deg,#f1f1f3,#a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Start offsetting today
          </h2>
          <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
            Join thousands of businesses and individuals fighting climate change on-chain.
          </p>
          <button className="btn btn-primary btn-xl" onClick={handleCTA}>
            {isConnected ? 'Open App →' : '🦊 Connect MetaMask'}
          </button>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: '2rem 2.5rem', textAlign: 'center',
        color: 'var(--text-faint)', fontSize: '.84rem',
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent-light)' }}>
          🌱 CarbonX
        </span>
        {' '}· Built with Solidity, Hardhat, React & ethers.js · Hackathon Project
      </footer>
    </div>
  )
}
