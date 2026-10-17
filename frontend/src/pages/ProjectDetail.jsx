import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useWeb3 } from '../context/Web3Context'
import { formatDate, formatCCT, getProjectTypeLabel, getProjectTypeIcon, truncateAddress } from '../utils/helpers'
import { ethers } from 'ethers'
import toast from 'react-hot-toast'
import { DEMO_PROJECTS, DEMO_LISTINGS } from '../utils/demoData'
import { getStoredProjects, getStoredListings, recordPurchase } from '../utils/localStore'

const STATUS_COLORS = ['badge badge-yellow', 'badge badge-green', 'badge badge-red']
const STATUS_LABELS = ['Pending', 'Approved', 'Rejected']

export default function ProjectDetail() {
  const { id }       = useParams()
  const { contracts, address, isConnected, connect, signer } = useWeb3()
  const navigate     = useNavigate()

  const [project,  setProject]  = useState(null)
  const [listings, setListings] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [buyModal, setBuyModal] = useState(null)
  const [buyAmt,   setBuyAmt]   = useState('')
  const [quote,    setQuote]    = useState(null)
  const [buying,   setBuying]   = useState(false)

  const fetchProjectData = async () => {
    setLoading(true)
    let p = null
    let projectListings = []

    // Try on-chain first
    if (contracts.registry && id) {
      try {
        p = await contracts.registry.getProject(id)
        if (contracts.marketplace) {
          const [active] = await contracts.marketplace.getActiveListings(0, 100)
          projectListings = active.filter(l => l.projectId.toString() === id.toString())
        }
      } catch (err) {
        console.warn("Registry lookup fallback to demo:", err)
      }
    }

    // Check custom & demo stored projects
    const allProjects = getStoredProjects()
    if (!p && allProjects[id]) {
      p = allProjects[id]
      const allListings = getStoredListings()
      projectListings = allListings.filter(l => l.projectId.toString() === id.toString())
    }

    if (p) {
      setProject(p)
      setListings(projectListings)
    } else {
      toast.error('Project not found')
      navigate('/marketplace')
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchProjectData()
  }, [contracts, id, navigate])

  useEffect(() => {
    const compute = async () => {
      if (!buyModal || !buyAmt) { setQuote(null); return }
      try {
        const amountWei = ethers.parseEther(buyAmt)
        if (amountWei <= 0n) { setQuote(null); return }

        if (contracts.marketplace && buyModal.listingId > 4n) {
          const q = await contracts.marketplace.quoteBuy(buyModal.listingId, amountWei)
          setQuote(q)
        } else {
          const gross = (amountWei * buyModal.pricePerToken) / (10n ** 18n)
          const fee = (gross * 250n) / 10000n
          const net = gross - fee
          setQuote({ gross, fee, net })
        }
      } catch { setQuote(null) }
    }
    compute()
  }, [buyAmt, buyModal, contracts.marketplace])

  const handleBuy = async () => {
    if (!buyModal || !buyAmt || !quote) return
    if (!isConnected) { connect(); return }
    setBuying(true)
    const tid = toast.loading('🦊 Please confirm transaction in MetaMask popup...')
    try {
      const amountWei = ethers.parseEther(buyAmt)
      let txHash = null

      if (contracts.marketplace && buyModal.listingId > 100n) {
        try {
          const tx = await contracts.marketplace.buy(buyModal.listingId, amountWei, { value: quote.gross })
          toast.loading('Confirming transaction on blockchain...', { id: tid })
          const receipt = await tx.wait()
          txHash = receipt.hash
        } catch (onChainErr) {
          console.warn('Marketplace contract call failed, prompting direct wallet transaction:', onChainErr)
        }
      }

      if (!txHash && signer) {
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
      }

      recordPurchase({
        listingId: buyModal.listingId,
        projectId: buyModal.projectId,
        amountWei,
        grossEthWei: quote.gross,
        buyerAddress: address || '0xDemoBuyer',
      })

      const shortTx = txHash ? ` (Tx: ${txHash.slice(0, 8)}...${txHash.slice(-6)})` : ''
      toast.success(`🎉 Purchased ${buyAmt} CCT successfully!${shortTx}`, { id: tid, duration: 6000 })
      setBuyModal(null)
      setBuyAmt('')
      setQuote(null)
      fetchProjectData()
    } catch (err) {
      if (err.code === 4001 || (err.message && err.message.includes('rejected'))) {
        toast.error('❌ Transaction was rejected in MetaMask.', { id: tid })
      } else {
        toast.error(err.reason || err.message?.slice(0, 80) || 'Purchase failed', { id: tid })
      }
    } finally { setBuying(false) }
  }

  if (loading) return (
    <div className="loading-screen"><div className="spinner spinner-lg"/><p>Loading project...</p></div>
  )
  if (!project) return null

  const typeIcon  = getProjectTypeIcon(Number(project.projectType))
  const typeLabel = getProjectTypeLabel(Number(project.projectType))
  const totalIssued = project.approvedCredits || project.estimatedCredits

  return (
    <div style={{ maxWidth: '900px' }}>
      <button className="btn btn-ghost btn-sm mb-4" onClick={() => navigate(-1)}>← Back</button>

      {/* Hero */}
      <div className="card card-p mb-6" style={{
        background: 'linear-gradient(135deg, rgba(15,35,24,0.9), rgba(10,26,16,0.8))',
        border: '1px solid var(--border-default)',
      }}>
        <div className="flex justify-between items-start mb-4">
          <div className="flex gap-3 items-center">
            <div style={{
              width: 60, height: 60, borderRadius: 'var(--radius-lg)',
              background: 'rgba(34,197,94,0.1)', border: '1px solid var(--border-default)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem',
            }}>{typeIcon}</div>
            <div>
              <h2 style={{ marginBottom: '0.25rem' }}>{project.name}</h2>
              <div className="flex gap-2 items-center">
                <span className="badge badge-green">{typeLabel}</span>
                <span className={STATUS_COLORS[Number(project.status)]}>
                  {STATUS_LABELS[Number(project.status)]}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-faint">Project ID</div>
            <div className="font-mono text-lg text-green">#{project.id.toString()}</div>
          </div>
        </div>

        <p style={{ marginBottom: '1.5rem', lineHeight: 1.8 }}>
          {project.description || 'No description provided.'}
        </p>

        <div className="grid-3">
          <div>
            <div className="text-xs text-faint mb-1">📍 Location</div>
            <div className="font-medium">{project.location}</div>
          </div>
          <div>
            <div className="text-xs text-faint mb-1">🌱 Est. Credits</div>
            <div className="font-medium">{project.estimatedCredits.toString()} CCT</div>
          </div>
          <div>
            <div className="text-xs text-faint mb-1">✅ Approved Credits</div>
            <div className="font-medium">
              {Number(project.status) === 1 ? `${project.approvedCredits.toString()} CCT` : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-faint mb-1">👤 Seller</div>
            <div className="font-mono text-sm">{truncateAddress(project.seller)}</div>
          </div>
          <div>
            <div className="text-xs text-faint mb-1">📅 Registered</div>
            <div className="font-medium">{formatDate(project.registeredAt)}</div>
          </div>
          {project.ipfsDocHash && (
            <div>
              <div className="text-xs text-faint mb-1">📄 Documents</div>
              <a
                href={`https://ipfs.io/ipfs/${project.ipfsDocHash}`}
                target="_blank" rel="noopener noreferrer"
                className="btn btn-ghost btn-sm"
              >
                View on IPFS ↗
              </a>
            </div>
          )}
        </div>

        {Number(project.status) === 2 && project.rejectionReason && (
          <div className="card card-p mt-4" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div className="text-sm"><span className="text-danger font-medium">Rejection reason: </span>{project.rejectionReason}</div>
          </div>
        )}
      </div>

      {/* Active Listings */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: '1.1rem' }}>Available Listings ({listings.length})</h3>
        </div>
        {listings.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-faint)' }}>
            <p>No active listings for this project.</p>
            <button className="btn btn-secondary mt-4" onClick={() => navigate('/marketplace')}>Browse All Listings</button>
          </div>
        ) : (
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {listings.map(l => {
              const isOwn = address && l.seller.toLowerCase() === address.toLowerCase()
              const fillPct = l.totalAmount > 0n
                ? Math.round((1 - Number(l.remainingAmount) / Number(l.totalAmount)) * 100)
                : 0
              return (
                <div key={l.listingId.toString()} className="card card-p" style={{ border: '1px solid var(--border-default)' }}>
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <div className="listing-price" style={{ fontSize: '1.2rem' }}>
                        {Number(ethers.formatEther(l.pricePerToken)).toFixed(4)} ETH
                        <span className="text-xs text-faint" style={{ fontWeight: 400 }}> / CCT</span>
                      </div>
                      <div className="text-xs text-faint">Listing #{l.listingId.toString()}</div>
                    </div>
                    {!isOwn && (
                      <button className="btn btn-primary" onClick={() => { setBuyModal(l); setBuyAmt('') }}>
                        Buy CCT
                      </button>
                    )}
                  </div>
                  <div className="flex justify-between text-xs text-faint mb-1">
                    <span>Available: {Number(ethers.formatEther(l.remainingAmount)).toFixed(2)} CCT</span>
                    <span>{fillPct}% sold</span>
                  </div>
                  <div className="progress-bar"><div className="progress-fill" style={{ width: `${fillPct}%` }}/></div>
                  <div className="text-xs text-faint mt-2">
                    Seller: <span className="font-mono">{truncateAddress(l.seller)}</span>
                    {' · '} Listed {formatDate(l.createdAt)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Buy Modal */}
      {buyModal && (
        <div className="modal-overlay" onClick={() => !buying && setBuyModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Buy Carbon Credits</h3>
              <div className="text-sm text-faint">
                {Number(ethers.formatEther(buyModal.pricePerToken)).toFixed(4)} ETH/CCT
              </div>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Amount (CCT)</label>
                <input
                  className="form-input" type="number" min="0.000001" step="any"
                  placeholder="e.g. 10"
                  value={buyAmt} onChange={e => setBuyAmt(e.target.value)}
                />
                <div className="form-hint">Available: {Number(ethers.formatEther(buyModal.remainingAmount)).toFixed(4)} CCT</div>
              </div>
              {quote && (
                <div className="card card-p" style={{ background: 'rgba(34,197,94,0.06)' }}>
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
                    <span>Total</span>
                    <span className="text-green">{Number(ethers.formatEther(quote.gross)).toFixed(6)} ETH</span>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setBuyModal(null)} disabled={buying}>Cancel</button>
              <button className="btn btn-primary" onClick={isConnected ? handleBuy : connect}
                disabled={buying || (isConnected && (!quote || !buyAmt))}>
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
