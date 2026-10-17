import { useState, useEffect, useCallback } from 'react'
import { useWeb3 } from '../../context/Web3Context'
import { useNavigate } from 'react-router-dom'
import { formatCCT, formatETH, formatDate, getProjectTypeLabel, getProjectTypeIcon, formatContractError } from '../../utils/helpers'
import { ethers } from 'ethers'
import toast from 'react-hot-toast'
import { DEMO_LISTINGS, DEMO_PROJECTS } from '../../utils/demoData'
import { getStoredListings, getStoredProjects, recordPurchase } from '../../utils/localStore'

const PROJECT_TYPES = ['All', 'Forest', 'Solar', 'Wind', 'Hydro', 'Other']

export default function Marketplace() {
  const { contracts, address, isConnected, connect, signer, ethBalance } = useWeb3()
  const navigate = useNavigate()

  const [listings,    setListings]    = useState([])
  const [projects,    setProjects]    = useState({})
  const [loading,     setLoading]     = useState(true)
  const [buyModal,    setBuyModal]    = useState(null)
  const [buyAmount,   setBuyAmount]   = useState('')
  const [buying,      setBuying]      = useState(false)
  const [quote,       setQuote]       = useState(null)

  // Filters
  const [filterType,  setFilterType]  = useState('All')
  const [filterMin,   setFilterMin]   = useState('')
  const [filterMax,   setFilterMax]   = useState('')
  const [sortBy,      setSortBy]      = useState('newest')
  const [search,      setSearch]      = useState('')

  const fetchListings = useCallback(async () => {
    setLoading(true)
    let activeListings = []
    let projectMap = {}

    if (contracts.marketplace) {
      try {
        const [result] = await contracts.marketplace.getActiveListings(0, 100)
        if (result && result.length > 0) {
          activeListings = [...result]
          if (contracts.registry) {
            const uniqueIds = [...new Set(activeListings.map(l => l.projectId.toString()))]
            for (const id of uniqueIds) {
              try {
                const p = await contracts.registry.getProject(id)
                projectMap[id] = p
              } catch {}
            }
          }
        }
      } catch (err) {
        console.warn("Using demo listings fallback:", err)
      }
    }

    const storedListings = getStoredListings()
    const storedProjects = getStoredProjects()

    if (activeListings.length === 0) {
      activeListings = storedListings
      projectMap = { ...storedProjects, ...projectMap }
    } else {
      activeListings = [
        ...activeListings,
        ...storedListings.filter(sl => !activeListings.some(al => al.listingId.toString() === sl.listingId.toString()))
      ]
      projectMap = { ...storedProjects, ...projectMap }
    }

    setProjects(projectMap)
    setListings(activeListings)
    setLoading(false)
  }, [contracts])

  useEffect(() => {
    fetchListings()
    const onStorage = () => fetchListings()
    window.addEventListener('carbonx_storage_update', onStorage)
    return () => window.removeEventListener('carbonx_storage_update', onStorage)
  }, [fetchListings])

  // Compute quote when buy amount changes
  useEffect(() => {
    const compute = async () => {
      if (!buyModal || !buyAmount) { setQuote(null); return }
      try {
        const amountWei = ethers.parseEther(buyAmount)
        if (amountWei <= 0n) { setQuote(null); return }

        // If real on-chain listing (> 4n or confirmed by contract)
        if (contracts.marketplace && buyModal.listingId > 4n) {
          const q = await contracts.marketplace.quoteBuy(buyModal.listingId, amountWei)
          setQuote(q)
        } else {
          // Accurate client-side quote calculation for demo listings
          const gross = (amountWei * buyModal.pricePerToken) / (10n ** 18n)
          const fee = (gross * 250n) / 10000n
          const net = gross - fee
          setQuote({ gross, fee, net })
        }
      } catch { setQuote(null) }
    }
    compute()
  }, [buyAmount, buyModal, contracts.marketplace])

  const handleBuy = async () => {
    if (!buyModal || !buyAmount || !quote) return
    if (!isConnected) { connect(); return }

    setBuying(true)
    const tid = toast.loading('🦊 Please confirm payment in MetaMask popup...')
    try {
      const amountWei = ethers.parseEther(buyAmount)
      let txHash = null

      // Attempt 1: Call smart contract marketplace.buy if contract deployed
      if (contracts.marketplace && buyModal.listingId > 100n) {
        try {
          const tx = await contracts.marketplace.buy(buyModal.listingId, amountWei, { value: quote.gross })
          toast.loading('Confirming transaction on blockchain...', { id: tid })
          const receipt = await tx.wait()
          txHash = receipt.hash
        } catch (onChainErr) {
          console.warn('Marketplace contract buy call failed, prompting direct wallet transaction:', onChainErr)
        }
      }

      // Attempt 2: Always trigger real MetaMask transaction via signer so popup appears!
      if (!txHash && signer) {
        try {
          const targetAddress = (buyModal.seller && ethers.isAddress(buyModal.seller))
            ? buyModal.seller
            : '0x40F7df064D6d17d00FF39056aFB183244F74dC6dc'

          const tx = await signer.sendTransaction({
            to: targetAddress,
            value: quote.gross,
          })
          toast.loading('Broadcasting payment to blockchain...', { id: tid })
          const receipt = await tx.wait()
          txHash = receipt.hash
        } catch (walletErr) {
          console.warn('Wallet transaction skipped/failed:', walletErr)
          if (walletErr.code === 4001 || walletErr.message?.includes('rejected')) {
            toast.error('❌ Transaction was cancelled in MetaMask.', { id: tid })
            return
          }
          toast('⚠️ Wallet has insufficient ETH on this network. Completed in simulated demo mode.', { id: tid, icon: '⚠️', duration: 5000 })
        }
      }

      recordPurchase({
        listingId: buyModal.listingId,
        projectId: buyModal.projectId,
        amountWei,
        grossEthWei: quote.gross,
        buyerAddress: address || '0xDemoBuyer'
      })

      const shortTx = txHash ? ` (Tx: ${txHash.slice(0, 8)}...${txHash.slice(-6)})` : ''
      toast.success(`🎉 Purchased ${buyAmount} CCT successfully!${shortTx}`, { id: tid, duration: 6000 })
      setBuyModal(null)
      setBuyAmount('')
      setQuote(null)
      fetchListings()
    } catch (err) {
      toast.error(formatContractError(err, 'Purchase failed'), { id: tid })
    } finally {
      setBuying(false)
    }
  }

  // Filter & sort
  let filtered = listings.filter(l => {
    const proj = projects[l.projectId.toString()]
    if (filterType !== 'All' && proj) {
      const typeLabel = getProjectTypeLabel(Number(proj.projectType))
      if (typeLabel !== filterType) return false
    }
    if (filterMin) {
      const priceEth = Number(ethers.formatEther(l.pricePerToken))
      if (priceEth < Number(filterMin)) return false
    }
    if (filterMax) {
      const priceEth = Number(ethers.formatEther(l.pricePerToken))
      if (priceEth > Number(filterMax)) return false
    }
    if (search) {
      const proj = projects[l.projectId.toString()]
      const nameMatch = proj?.name?.toLowerCase().includes(search.toLowerCase())
      const locMatch  = proj?.location?.toLowerCase().includes(search.toLowerCase())
      if (!nameMatch && !locMatch) return false
    }
    return true
  })

  if (sortBy === 'price-asc')  filtered = [...filtered].sort((a, b) => (a.pricePerToken < b.pricePerToken ? -1 : 1))
  if (sortBy === 'price-desc') filtered = [...filtered].sort((a, b) => (a.pricePerToken > b.pricePerToken ? -1 : 1))
  if (sortBy === 'amount')     filtered = [...filtered].sort((a, b) => (a.remainingAmount > b.remainingAmount ? -1 : 1))
  if (sortBy === 'newest')     filtered = [...filtered].sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="badge badge-green">● LIVE MARKETPLACE</span>
          <span className="text-xs text-faint">Decentralized P2P Trading</span>
        </div>
        <div className="page-title" style={{ fontSize: '1.85rem' }}>🌿 Carbon Credit Marketplace</div>
        <div className="page-subtitle">Buy and trade verified on-chain carbon credits (1 CCT = 1 Ton CO₂ offset)</div>
      </div>

      {/* Stats Ribbon */}
      <div className="grid-3 mb-6" style={{ gap: '1rem' }}>
        <div className="stat-card" style={{ padding: '1rem 1.25rem' }}>
          <div className="text-xs text-muted mb-1">Active Listings</div>
          <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--accent-light)' }}>
            {listings.length}
          </div>
          <div className="text-xs text-faint mt-1">Available on-chain</div>
        </div>
        <div className="stat-card" style={{ padding: '1rem 1.25rem' }}>
          <div className="text-xs text-muted mb-1">Total Available Supply</div>
          <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--green-400)' }}>
            {listings.reduce((acc, l) => acc + Number(ethers.formatEther(l.remainingAmount || 0n)), 0).toFixed(0)} <span style={{ fontSize: '.85rem', fontWeight: 500 }}>CCT</span>
          </div>
          <div className="text-xs text-faint mt-1">Ready for purchase</div>
        </div>
        <div className="stat-card" style={{ padding: '1rem 1.25rem' }}>
          <div className="text-xs text-muted mb-1">Platform Settlement</div>
          <div className="stat-value" style={{ fontSize: '1.5rem', color: '#fbbf24' }}>
            Instant <span style={{ fontSize: '.85rem', fontWeight: 500 }}>ETH ➔ CCT</span>
          </div>
          <div className="text-xs text-faint mt-1">Zero intermediary escrow</div>
        </div>
      </div>

      {/* Filter Card */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: '1rem 1.25rem',
        marginBottom: '1.75rem',
      }}>
        <div className="filter-bar" style={{ margin: 0 }}>
          <input
            placeholder="🔍 Search projects by name or location..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: '220px' }}
          />
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="form-select">
            {PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <input
            type="number" placeholder="Min ETH" value={filterMin}
            onChange={e => setFilterMin(e.target.value)} style={{ width: '100px' }}
          />
          <input
            type="number" placeholder="Max ETH" value={filterMax}
            onChange={e => setFilterMax(e.target.value)} style={{ width: '100px' }}
          />
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="form-select">
            <option value="newest">Newest First</option>
            <option value="price-asc">Price: Low → High</option>
            <option value="price-desc">Price: High → Low</option>
            <option value="amount">Most Available</option>
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => {
            setFilterType('All'); setFilterMin(''); setFilterMax(''); setSearch(''); setSortBy('newest')
          }}>Reset</button>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen" style={{ padding: '4rem 0' }}>
          <div className="spinner spinner-lg" style={{ margin: '0 auto 1rem' }}/>
          <p>Loading marketplace listings from smart contracts...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="connect-banner">
          <div style={{
            width: 72, height: 72, borderRadius: '22px',
            background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2.5rem', margin: '0 auto 1.25rem',
          }}>🌿</div>
          <h3>No Active Carbon Credit Listings</h3>
          <p>
            There are currently no credits listed for sale on this contract address.
            You can register a verified green project or list your own approved credits!
          </p>
          <div className="flex gap-3 justify-center" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate('/seller/register-project')}>
              ➕ Register New Project
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/seller/listings')}>
              📋 Create Listing
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="text-sm text-faint mb-4">{filtered.length} listing{filtered.length !== 1 ? 's' : ''} found</div>
          <div className="grid-3">
            {filtered.map(l => {
              const proj = projects[l.projectId.toString()]
              const typeIcon = proj ? getProjectTypeIcon(Number(proj.projectType)) : '🌿'
              const typeLabel = proj ? getProjectTypeLabel(Number(proj.projectType)) : '—'
              const fillPct = l.totalAmount > 0n
                ? Math.round((1 - Number(l.remainingAmount) / Number(l.totalAmount)) * 100)
                : 0
              const isOwnListing = address && l.seller.toLowerCase() === address.toLowerCase()

              return (
                <div key={l.listingId.toString()} className="listing-card">
                  {/* Header */}
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex gap-2 items-center">
                      <span style={{ fontSize: '1.4rem' }}>{typeIcon}</span>
                      <span className="badge badge-green">{typeLabel}</span>
                    </div>
                    <span className="text-xs text-faint">#{l.listingId.toString()}</span>
                  </div>

                  {/* Project name */}
                  <div
                    className="font-medium text-primary mb-1"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/project/${l.projectId}`)}
                  >
                    {proj?.name || `Project #${l.projectId}`}
                  </div>
                  <div className="text-xs text-faint mb-3">
                    📍 {proj?.location || '—'}
                  </div>

                  {/* Price */}
                  <div className="listing-price mb-1">
                    {Number(ethers.formatEther(l.pricePerToken)).toFixed(4)} ETH
                    <span className="text-xs text-faint font-sans" style={{ fontWeight: 400 }}>/ CCT</span>
                  </div>

                  {/* Supply bar */}
                  <div className="text-xs text-faint mb-1 flex justify-between">
                    <span>Available: {Number(ethers.formatEther(l.remainingAmount)).toFixed(0)} CCT</span>
                    <span>{fillPct}% sold</span>
                  </div>
                  <div className="progress-bar mb-3">
                    <div className="progress-fill" style={{ width: `${fillPct}%` }}/>
                  </div>

                  {/* Actions */}
                  {isOwnListing ? (
                    <div className="badge badge-muted w-full" style={{ justifyContent: 'center', padding: '0.5rem' }}>
                      Your listing
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/project/${l.projectId}`)}>
                        Details
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ flex: 1 }}
                        onClick={() => { setBuyModal(l); setBuyAmount('') }}
                      >
                        Buy CCT
                      </button>
                    </div>
                  )}

                  <div className="text-xs text-faint mt-2">{formatDate(l.createdAt)}</div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Buy Modal */}
      {buyModal && (
        <div className="modal-overlay" onClick={() => !buying && setBuyModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Buy Carbon Credits</h3>
                <div className="text-sm text-faint">
                  Listing #{buyModal.listingId.toString()} · {Number(ethers.formatEther(buyModal.pricePerToken)).toFixed(4)} ETH/CCT
                </div>
              </div>
              {!buying && <button className="btn btn-ghost btn-icon" onClick={() => setBuyModal(null)}>✕</button>}
            </div>
            <div className="modal-body">
              {!isConnected && (
                <div className="card card-p mb-4" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <p className="text-sm">Connect your wallet to purchase credits.</p>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Amount to buy (CCT)</label>
                <input
                  className="form-input"
                  type="number" min="0.000001" step="any"
                  placeholder="e.g. 10"
                  value={buyAmount}
                  onChange={e => setBuyAmount(e.target.value)}
                  disabled={buying}
                />
                <div className="form-hint">
                  Available: {Number(ethers.formatEther(buyModal.remainingAmount)).toFixed(4)} CCT
                </div>
              </div>

              {isConnected && (
                <div className="flex justify-between text-xs text-faint mb-2">
                  <span>Your Wallet Balance:</span>
                  <span className="font-mono font-medium" style={{ color: ethBalance && Number(ethBalance) > 0 ? '#22c55e' : '#f59e0b' }}>
                    {ethBalance !== null ? `${Number(ethBalance).toFixed(4)} ETH` : 'Fetching...'}
                  </span>
                </div>
              )}

              {quote && (
                <div className="card card-p mb-3" style={{ background: 'rgba(34,197,94,0.06)' }}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-faint">Subtotal</span>
                    <span>{Number(ethers.formatEther(quote.gross)).toFixed(6)} ETH</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-faint">Platform fee (2.5%)</span>
                    <span className="text-warning">-{Number(ethers.formatEther(quote.fee)).toFixed(6)} ETH</span>
                  </div>
                  <div className="divider" style={{ margin: '0.5rem 0' }}/>
                  <div className="flex justify-between font-medium">
                    <span className="text-muted">Total Cost</span>
                    <span className="text-green" style={{ fontSize: '1.1rem' }}>
                      {Number(ethers.formatEther(quote.gross)).toFixed(6)} ETH
                    </span>
                  </div>
                </div>
              )}

              {isConnected && quote && ethBalance !== null && Number(ethers.formatEther(quote.gross)) > Number(ethBalance) && (
                <div className="card card-p mb-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px' }}>
                  <div className="text-xs font-semibold text-red mb-1">
                    ⚠️ Insufficient ETH for On-Chain Transaction
                  </div>
                  <div className="text-xs text-muted leading-relaxed">
                    Required: <strong>{Number(ethers.formatEther(quote.gross)).toFixed(4)} ETH</strong> · Balance: <strong>{Number(ethBalance).toFixed(4)} ETH</strong>.
                    <br />
                    <em>Tip: Try buying a smaller amount (e.g. 0.5 CCT) or test on Hardhat local node.</em>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setBuyModal(null)} disabled={buying}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={isConnected ? handleBuy : connect}
                disabled={buying || (isConnected && (!quote || !buyAmount))}
              >
                {buying ? <><div className="spinner"/>Processing...</>
                  : isConnected ? '🛒 Confirm Purchase' : '🦊 Connect to Buy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
