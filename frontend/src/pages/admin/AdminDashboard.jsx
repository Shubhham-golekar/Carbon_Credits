import { useState, useEffect, useCallback } from 'react'
import { useWeb3 } from '../../context/Web3Context'
import { formatCCT, formatDate, truncateAddress } from '../../utils/helpers'
import { ethers } from 'ethers'
import toast from 'react-hot-toast'

const PROJECT_TYPES   = ['Forest','Solar','Wind','Hydro','Other']
const PROJECT_STATUS  = ['Pending','Approved','Rejected']
const STATUS_BADGE    = ['badge badge-yellow','badge badge-green','badge badge-red']

export default function AdminDashboard() {
  const { contracts, address, isConnected, connect, roles } = useWeb3()

  const [loading,      setLoading]      = useState(true)
  const [projects,     setProjects]     = useState([])
  const [totalIssued,  setTotalIssued]  = useState(0n)
  const [totalRetired, setTotalRetired] = useState(0n)
  const [totalProj,    setTotalProj]    = useState(0n)

  // Tabs
  const [activeTab,    setActiveTab]    = useState('pending')

  // Verifier actions
  const [approveModal, setApproveModal] = useState(null)
  const [rejectModal,  setRejectModal]  = useState(null)
  const [mintModal,    setMintModal]    = useState(null)
  const [actionLoading,setActionLoading]= useState(false)

  // Role grant
  const [grantAddr,    setGrantAddr]    = useState('')
  const [grantRole,    setGrantRole]    = useState('seller')
  const [granting,     setGranting]     = useState(false)

  const fetchData = useCallback(async () => {
    if (!contracts.registry || !contracts.cct) return
    setLoading(true)
    try {
      const total  = await contracts.registry.totalProjects()
      const issued = await contracts.cct.totalIssued()
      const retired= await contracts.cct.totalRetired()
      setTotalIssued(issued)
      setTotalRetired(retired)
      setTotalProj(total)

      const arr = []
      for (let i = 1; i <= Number(total); i++) {
        try {
          const p = await contracts.registry.getProject(i)
          arr.push(p)
        } catch {}
      }
      setProjects(arr)
    } catch {
      toast.error('Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }, [contracts])

  useEffect(() => { if (isConnected) fetchData() }, [fetchData, isConnected])

  if (!isConnected) return (
    <div className="connect-banner">
      <div className="connect-banner-icon">⚙️</div>
      <h2>Connect your wallet</h2>
      <button className="btn btn-primary btn-lg" onClick={connect}>🦊 Connect Wallet</button>
    </div>
  )

  if (!roles.isVerifier && !roles.isAdmin) return (
    <div className="connect-banner">
      <div className="connect-banner-icon">🚫</div>
      <h2>Admin / Verifier access required</h2>
      <p>Your wallet does not have the required role to view this page.</p>
    </div>
  )

  if (loading) return (
    <div className="loading-screen"><div className="spinner spinner-lg"/><p>Loading admin panel...</p></div>
  )

  const pending  = projects.filter(p => Number(p.status) === 0)
  const approved = projects.filter(p => Number(p.status) === 1)
  const rejected = projects.filter(p => Number(p.status) === 2)
  const tabProjects = activeTab === 'pending' ? pending : activeTab === 'approved' ? approved : rejected

  // ── Actions ────────────────────────────────────────────────
  const handleApprove = async ({ projectId, approvedCredits }) => {
    setActionLoading(true)
    const tid = toast.loading('Approving project...')
    try {
      const tx = await contracts.registry.approveProject(projectId, BigInt(approvedCredits))
      await tx.wait()
      toast.success('Project approved! Minting can now proceed.', { id: tid })
      setApproveModal(null)
      fetchData()
    } catch (err) {
      toast.error(err.reason || 'Approval failed', { id: tid })
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async ({ projectId, reason }) => {
    setActionLoading(true)
    const tid = toast.loading('Rejecting project...')
    try {
      const tx = await contracts.registry.rejectProject(projectId, reason)
      await tx.wait()
      toast.success('Project rejected.', { id: tid })
      setRejectModal(null)
      fetchData()
    } catch (err) {
      toast.error(err.reason || 'Failed', { id: tid })
    } finally {
      setActionLoading(false)
    }
  }

  const handleMint = async ({ seller, amount, projectId }) => {
    setActionLoading(true)
    const tid = toast.loading('Minting credits...')
    try {
      const tx = await contracts.cct.mint(seller, BigInt(amount), BigInt(projectId))
      await tx.wait()
      toast.success(`Minted ${amount} CCT to ${truncateAddress(seller)}`, { id: tid })
      setMintModal(null)
      fetchData()
    } catch (err) {
      toast.error(err.reason || 'Minting failed', { id: tid })
    } finally {
      setActionLoading(false)
    }
  }

  const handleGrantRole = async () => {
    if (!ethers.isAddress(grantAddr)) { toast.error('Invalid address'); return }
    setGranting(true)
    const tid = toast.loading('Granting role...')
    try {
      let tx
      if (grantRole === 'seller') {
        tx = await contracts.cct.registerSeller(grantAddr)
        await contracts.registry.grantSellerRole(grantAddr)
      } else if (grantRole === 'verifier') {
        const VERIFIER = ethers.keccak256(ethers.toUtf8Bytes('VERIFIER_ROLE'))
        tx = await contracts.cct.grantRole(VERIFIER, grantAddr)
        await contracts.registry.grantVerifierRole(grantAddr)
      }
      if (tx) await tx.wait()
      toast.success(`${grantRole} role granted!`, { id: tid })
      setGrantAddr('')
    } catch (err) {
      toast.error(err.reason || 'Failed', { id: tid })
    } finally {
      setGranting(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Admin Panel ⚙️</div>
        <div className="page-subtitle">Verify projects, mint credits, and manage roles</div>
      </div>

      {/* Stats */}
      <div className="grid-4 mb-6">
        <div className="stat-card">
          <span className="stat-icon">📋</span>
          <div className="stat-label">Total Projects</div>
          <div className="stat-value">{totalProj.toString()}</div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">⏳</span>
          <div className="stat-label">Pending Review</div>
          <div className="stat-value" style={{ color: '#fbbf24' }}>{pending.length}</div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">💰</span>
          <div className="stat-label">Total Issued</div>
          <div className="stat-value">{Number(ethers.formatEther(totalIssued)).toFixed(0)}</div>
          <div className="stat-sub">CCT</div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🌿</span>
          <div className="stat-label">Total Retired</div>
          <div className="stat-value">{Number(ethers.formatEther(totalRetired)).toFixed(0)}</div>
          <div className="stat-sub">CCT</div>
        </div>
      </div>

      {/* Grant Role Panel */}
      <div className="card card-p mb-6">
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>Grant Platform Role</h3>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="form-group" style={{ flex: 2, minWidth: '260px', marginBottom: 0 }}>
            <label className="form-label">Wallet Address</label>
            <input
              className="form-input font-mono"
              placeholder="0x..."
              value={grantAddr}
              onChange={e => setGrantAddr(e.target.value)}
              style={{ fontSize: '0.85rem' }}
            />
          </div>
          <div className="form-group" style={{ minWidth: '130px', marginBottom: 0 }}>
            <label className="form-label">Role</label>
            <select className="form-input form-select" value={grantRole} onChange={e => setGrantRole(e.target.value)}>
              <option value="seller">Seller</option>
              <option value="verifier">Verifier</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleGrantRole} disabled={granting}>
            {granting ? <><div className="spinner"/>Granting...</> : 'Grant Role'}
          </button>
        </div>
      </div>

      {/* Project Review Tabs */}
      <div className="card">
        <div className="card-header">
          <div className="flex gap-3">
            {['pending','approved','rejected'].map(tab => (
              <button
                key={tab}
                className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'pending' ? `⏳ Pending (${pending.length})`
                  : tab === 'approved' ? `✅ Approved (${approved.length})`
                  : `❌ Rejected (${rejected.length})`}
              </button>
            ))}
          </div>
        </div>

        {tabProjects.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-faint)' }}>
            No {activeTab} projects.
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th><th>Name</th><th>Seller</th><th>Type</th><th>Est. Credits</th>
                  <th>Approved</th><th>Status</th><th>Registered</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tabProjects.map(p => (
                  <tr key={p.id.toString()}>
                    <td className="text-muted">#{p.id.toString()}</td>
                    <td className="font-medium text-primary">{p.name}</td>
                    <td className="font-mono text-sm">{truncateAddress(p.seller)}</td>
                    <td>{PROJECT_TYPES[Number(p.projectType)]}</td>
                    <td>{p.estimatedCredits.toString()} CCT</td>
                    <td>{Number(p.status) === 1 ? `${p.approvedCredits.toString()} CCT` : '—'}</td>
                    <td><span className={STATUS_BADGE[Number(p.status)]}>{PROJECT_STATUS[Number(p.status)]}</span></td>
                    <td>{formatDate(p.registeredAt)}</td>
                    <td>
                      <div className="flex gap-2">
                        {Number(p.status) === 0 && (
                          <>
                            <button className="btn btn-secondary btn-sm"
                              onClick={() => setApproveModal({ projectId: p.id, estimatedCredits: p.estimatedCredits.toString(), approvedCredits: p.estimatedCredits.toString() })}>
                              Approve
                            </button>
                            <button className="btn btn-danger btn-sm"
                              onClick={() => setRejectModal({ projectId: p.id, reason: '' })}>
                              Reject
                            </button>
                          </>
                        )}
                        {Number(p.status) === 1 && (
                          <button className="btn btn-primary btn-sm"
                            onClick={() => setMintModal({ projectId: p.id, seller: p.seller, maxCredits: p.approvedCredits.toString(), amount: '' })}>
                            Mint CCT
                          </button>
                        )}
                        {p.ipfsDocHash && (
                          <a
                            href={`https://ipfs.io/ipfs/${p.ipfsDocHash}`}
                            target="_blank" rel="noopener noreferrer"
                            className="btn btn-ghost btn-sm"
                          >
                            Docs
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approve Modal */}
      {approveModal && (
        <div className="modal-overlay" onClick={() => !actionLoading && setApproveModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">✅ Approve Project #{approveModal.projectId.toString()}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setApproveModal(null)} disabled={actionLoading}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Approved Credits (CCT)</label>
                <input
                  className="form-input" type="number" min="1"
                  value={approveModal.approvedCredits}
                  onChange={e => setApproveModal(m => ({ ...m, approvedCredits: e.target.value }))}
                />
                <div className="form-hint">Seller estimated: {approveModal.estimatedCredits} CCT</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setApproveModal(null)} disabled={actionLoading}>Cancel</button>
              <button className="btn btn-primary" disabled={actionLoading}
                onClick={() => handleApprove({ projectId: approveModal.projectId, approvedCredits: approveModal.approvedCredits })}>
                {actionLoading ? <><div className="spinner"/>Approving...</> : 'Approve Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="modal-overlay" onClick={() => !actionLoading && setRejectModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">❌ Reject Project #{rejectModal.projectId.toString()}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setRejectModal(null)} disabled={actionLoading}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Rejection Reason *</label>
                <textarea
                  className="form-input form-textarea" rows={3}
                  placeholder="e.g. Insufficient documentation, project methodology unclear..."
                  value={rejectModal.reason}
                  onChange={e => setRejectModal(m => ({ ...m, reason: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setRejectModal(null)} disabled={actionLoading}>Cancel</button>
              <button className="btn btn-danger" disabled={actionLoading || !rejectModal.reason.trim()}
                onClick={() => handleReject({ projectId: rejectModal.projectId, reason: rejectModal.reason })}>
                {actionLoading ? <><div className="spinner"/>Rejecting...</> : 'Reject Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mint Modal */}
      {mintModal && (
        <div className="modal-overlay" onClick={() => !actionLoading && setMintModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">🪙 Mint Credits — Project #{mintModal.projectId.toString()}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setMintModal(null)} disabled={actionLoading}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Seller Address</label>
                <div className="form-input font-mono text-sm" style={{ opacity: 0.7 }}>{mintModal.seller}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Amount to Mint (CCT)</label>
                <input
                  className="form-input" type="number" min="1"
                  placeholder={`Max: ${mintModal.maxCredits}`}
                  value={mintModal.amount}
                  onChange={e => setMintModal(m => ({ ...m, amount: e.target.value }))}
                />
                <div className="form-hint">Approved allocation: {mintModal.maxCredits} CCT</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setMintModal(null)} disabled={actionLoading}>Cancel</button>
              <button className="btn btn-primary" disabled={actionLoading || !mintModal.amount}
                onClick={() => handleMint({ seller: mintModal.seller, amount: mintModal.amount, projectId: mintModal.projectId })}>
                {actionLoading ? <><div className="spinner"/>Minting...</> : '🪙 Mint Credits'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
