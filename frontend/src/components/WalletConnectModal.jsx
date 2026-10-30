import { useEffect, useState } from 'react'
import { useWeb3 } from '../context/Web3Context'

/**
 * WalletConnectModal
 * Appears on first visit (if wallet not connected).
 * Connects through the BrigadeKey browser wallet.
 */
export default function WalletConnectModal({ onClose }) {
  const { connect, getWalletOptions, isConnected, error } = useWeb3()
  const [step, setStep]         = useState('pick')   // 'pick' | 'connecting'
  const [shake, setShake]       = useState(false)
  const [walletOptions, setWalletOptions] = useState([])

  useEffect(() => {
    let active = true
    getWalletOptions().then((options) => {
      if (active) setWalletOptions(options)
    })
    return () => { active = false }
  }, [getWalletOptions])

  // Close when connected
  useEffect(() => {
    if (isConnected) onClose?.()
  }, [isConnected, onClose])

  const handleWallet = async (walletProvider) => {
    setStep('connecting')
    const success = await connect(walletProvider)
    if (success) {
      onClose?.()
    } else {
      setShake(true)
      setTimeout(() => { setShake(false); setStep('pick') }, 700)
    }
  }

  const requiresPageRefresh = /was updated.*refresh this page/i.test(error || '')

  return (
    <div className="wallet-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`wallet-modal${shake ? ' modal-shake' : ''}`} style={{ position: 'relative' }}>

        {/* Close */}
        {onClose && (
          <button
            className="modal-close"
            onClick={onClose}
            style={{ position: 'absolute', top: '1rem', right: '1rem' }}
          >✕</button>
        )}

        {/* Logo + Title */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div className="wallet-modal-logo">🌱</div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '.35rem', color: 'var(--text-primary)' }}>
            Connect to CarbonX
          </h3>
          <p style={{ fontSize: '.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Connect your wallet to trade carbon credits<br />and offset your CO₂ footprint on-chain.
          </p>
        </div>

        {/* ── PICK STEP ── */}
        {step === 'pick' && (
          <>
            <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginBottom: '.5rem' }}>
              Select BrigadeKey from your detected browser wallets.
            </p>
            {walletOptions.length > 0 ? walletOptions.map((wallet, index) => (
              <button
                className="wallet-option"
                onClick={() => handleWallet(wallet.provider)}
                id={wallet.isBrigadeKey ? 'wallet-brigadekey-btn' : `wallet-provider-${index}`}
                key={wallet.id}
                type="button"
                style={{ width: '100%', color: 'inherit', textAlign: 'left' }}
              >
                <div className="wallet-option-icon" style={{ background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.2)' }}>
                  <span aria-hidden="true" style={{ fontSize: 22 }}>🔑</span>
                </div>
                <div>
                  <div className="wallet-option-name">{wallet.name}</div>
                  <div className="wallet-option-desc">
                    {wallet.isBrigadeKey ? 'BrigadeKey wallet' : 'Browser wallet provider'}
                  </div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: '.7rem', color: 'var(--accent-light)', fontWeight: 600 }}>
                  CONNECT
                </span>
              </button>
            )) : (
              <p style={{ fontSize: '.85rem', color: 'var(--text-muted)', padding: '.75rem 0' }}>
                No browser wallet detected. Enable BrigadeKey and reopen this window.
              </p>
            )}

            {/* WalletConnect */}
            <div
              className="wallet-option"
              style={{ opacity: .5, cursor: 'not-allowed' }}
              title="WalletConnect — coming soon"
            >
              <div className="wallet-option-icon" style={{ background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.2)' }}>
                <img
                  src="https://avatars.githubusercontent.com/u/37784886?s=40"
                  alt="WalletConnect"
                  style={{ width: 26, height: 26, borderRadius: 6 }}
                  onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.textContent = '🔗' }}
                />
              </div>
              <div>
                <div className="wallet-option-name">WalletConnect</div>
                <div className="wallet-option-desc">Scan with mobile wallet</div>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: '.7rem', color: 'var(--text-faint)', fontWeight: 600 }}>SOON</span>
            </div>

            {/* Coinbase */}
            <div
              className="wallet-option"
              style={{ opacity: .5, cursor: 'not-allowed' }}
              title="Coinbase Wallet — coming soon"
            >
              <div className="wallet-option-icon" style={{ background: 'rgba(37,99,235,.1)', border: '1px solid rgba(37,99,235,.2)' }}>
                <img
                  src="https://avatars.githubusercontent.com/u/18060234?s=40"
                  alt="Coinbase"
                  style={{ width: 26, height: 26, borderRadius: 6 }}
                  onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.textContent = '🔵' }}
                />
              </div>
              <div>
                <div className="wallet-option-name">Coinbase Wallet</div>
                <div className="wallet-option-desc">Connect Coinbase Wallet</div>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: '.7rem', color: 'var(--text-faint)', fontWeight: 600 }}>SOON</span>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                marginTop: '.75rem', padding: '.65rem .9rem',
                background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)',
                borderRadius: 'var(--radius-md)', fontSize: '.8rem', color: '#f87171',
              }}>
                ⚠ {error}
                {requiresPageRefresh && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => window.location.reload()}
                    style={{ display: 'flex', marginTop: '.65rem' }}
                    type="button"
                  >
                    Refresh page and reconnect
                  </button>
                )}
              </div>
            )}

            <div className="wallet-divider">secured by your browser</div>
            <p style={{ fontSize: '.73rem', color: 'var(--text-faint)', textAlign: 'center', lineHeight: 1.6 }}>
              By connecting, you agree to the{' '}
              <span style={{ color: 'var(--accent-light)' }}>Terms of Service</span>{' '}
              and confirm you are 18+.
            </p>
          </>
        )}

        {/* ── CONNECTING STEP ── */}
        {step === 'connecting' && (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: 'rgba(249,115,22,.1)', border: '1px solid rgba(249,115,22,.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem', fontSize: '2rem',
            }}>🔑</div>
            <div className="spinner-lg" style={{ margin: '0 auto 1rem' }} />
            <h4 style={{ marginBottom: '.5rem' }}>Waiting for BrigadeKey</h4>
            <p style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>
              Check the BrigadeKey popup in your browser extension.<br />
              Approve the connection request to continue.
            </p>
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginTop: '1.25rem' }}
              onClick={() => setStep('pick')}
            >
              Cancel
            </button>
          </div>
        )}

      </div>

      <style>{`
        .modal-shake {
          animation: shake .4s ease;
        }
        @keyframes shake {
          0%,100% { transform:translateX(0); }
          20%      { transform:translateX(-8px); }
          40%      { transform:translateX(8px); }
          60%      { transform:translateX(-5px); }
          80%      { transform:translateX(5px); }
        }
      `}</style>
    </div>
  )
}
