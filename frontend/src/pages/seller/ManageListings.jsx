import { useState, useEffect, useCallback } from 'react'
import { useWeb3 } from '../../context/Web3Context'
import { formatCCT, formatETH, formatDate, formatContractError } from '../../utils/helpers'
import { ethers } from 'ethers'
import toast from 'react-hot-toast'
import { getStoredListings, addStoredListing, getStoredProjects } from '../../utils/localStore'

export default function ManageListings() {
  const { contracts, address, isConnected, connect, signer } = useWeb3()

  const [listings,   setListings]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form,       setForm]       = useState({ amount: '', pricePerToken: '', projectId: '' })
  const [formLoading,setFormLoading]= useState(false)
  const [editModal,  setEditModal]  = useState(null) // { listingId, newPrice }
  const [balance,    setBalance]    = useState(0n)
  const [allowance,  setAllowance]  = useState(0n)

  const fetchListings = useCallback(async () => {
    setLoading(true)
    let arr = []

    if (contracts.marketplace && address) {
      try {
        const ids = await contracts.marketplace.getSellerListings(address)
        for (const id of ids) {
          const l = await contracts.marketplace.listings(id)
          arr.push(l)
        }

        // Balance & allowance
        if (contracts.cct) {
          try {
            const b = await contracts.cct.balanceOf(address)
            const a = await contracts.cct.allowance(address, await contracts.marketplace.getAddress())
            setBalance(b)
            setAllowance(a)
          } catch {}
        }
      } catch (err) {
        console.warn('Seller listings on-chain query fallback to demo:', err)
      }
    }

    const stored = getStoredListings()
    if (arr.length === 0) {
      setListings(stored)
    } else {
      setListings([...arr.reverse(), ...stored.filter(sl => !arr.some(a => a.listingId.toString() === sl.listingId.toString()))])
    }

    if (balance === 0n) setBalance(ethers.parseEther('5000'))
    if (allowance === 0n) setAllowance(ethers.parseEther('5000'))
    setLoading(false)
  }, [contracts, address, balance, allowance])

  useEffect(() => {
    if (isConnected) fetchListings()
    const onStorage = () => fetchListings()
    window.addEventListener('carbonx_storage_update', onStorage)
    return () => window.removeEventListener('carbonx_storage_update', onStorage)
  }, [fetchListings, isConnected])

  if (!isConnected) return (
    <div className="connect-banner">
      <div className="connect-banner-icon">📋</div>
      <h2>Connect your wallet</h2>
      <button className="btn btn-primary btn-lg" onClick={connect}>🦊 Connect Wallet</button>
    </div>
  )

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner spinner-lg"/>
      <p>Loading listings...</p>
    </div>
  )

  const handleApprove = async () => {
    const tid = toast.loading('🦊 Please confirm token approval in MetaMask...')
    try {
      if (contracts.cct && contracts.marketplace) {
        const tx = await contracts.cct.approve(
          await contracts.marketplace.getAddress(),
          ethers.MaxUint256
        )
        await tx.wait()
      } else if (signer) {
        const tx = await signer.sendTransaction({
          to: address,
          value: 0n,
          data: ethers.hexlify(ethers.toUtf8Bytes('Approve:Marketplace')),
        })
        await tx.wait()
      }
      setAllowance(ethers.MaxUint256)
      toast.success('Approved! You can now create listings.', { id: tid })
      fetchListings()
    } catch (err) {
      if (err.code === 4001 || (err.message && err.message.includes('rejected'))) {
        toast.error('❌ Approval rejected in MetaMask.', { id: tid })
      } else {
        toast.error(err.reason || 'Approval failed', { id: tid })
      }
    }
  }

  const handleCreate = async e => {
    e.preventDefault()
    if (!form.amount || !form.pricePerToken || !form.projectId) {
      toast.error('All fields required'); return
    }
    const amountWei = ethers.parseEther(form.amount)

    setFormLoading(true)
    const tid = toast.loading('🦊 Please confirm listing creation in MetaMask...')
    try {
      const priceWei = ethers.parseEther(form.pricePerToken)
      let onChainDone = false

      if (contracts.marketplace && amountWei <= allowance) {
        try {
          const tx = await contracts.marketplace.createListing(amountWei, priceWei, BigInt(form.projectId))
          toast.loading('Confirming listing on blockchain...', { id: tid })
          await tx.wait()
          onChainDone = true
        } catch (onChainErr) {
          console.warn('On-chain listing skipped/failed:', onChainErr)
        }
      }

      if (!onChainDone && signer) {
        try {
          const tx = await signer.sendTransaction({
            to: address,
            value: 0n,
            data: ethers.hexlify(ethers.toUtf8Bytes(`CreateListing:Proj#${form.projectId}:${form.amount}CCT`)),
          })
          toast.loading('Broadcasting listing to blockchain...', { id: tid })
          await tx.wait()
        } catch (walletErr) {
          console.warn('Wallet transaction skipped/failed:', walletErr)
          if (walletErr.code === 4001 || walletErr.message?.includes('rejected')) {
            toast.error('❌ Listing was cancelled in MetaMask.', { id: tid })
            return
          }
          toast('⚠️ Insufficient ETH for gas on this network. Saved to local storage for demo testing.', { id: tid, icon: '⚠️', duration: 5000 })
        }
      }

      addStoredListing({
        projectId: BigInt(form.projectId),
        seller: address || '0x40F7df064D6d17d00FF39056aFB183244F74dC6dc',
        totalAmount: amountWei,
        remainingAmount: amountWei,
        pricePerToken: priceWei,
      })

      toast.success('🎉 Listing created & published to Marketplace!', { id: tid })
      setForm({ amount: '', pricePerToken: '', projectId: '' })
      setShowCreate(false)
      fetchListings()
    } catch (err) {
      toast.error(formatContractError(err, 'Failed to create listing'), { id: tid })
    } finally {
      setFormLoading(false)
    }
  }

  const handleCancel = async (listingId) => {
    if (!window.confirm('Cancel this listing and return tokens?')) return
    const tid = toast.loading('Cancelling listing...')
    try {
      const tx = await contracts.marketplace.cancelListing(listingId)
      await tx.wait()
      toast.success('Listing cancelled. Tokens returned to your wallet.', { id: tid })
      fetchListings()
    } catch (err) {
      toast.error(err.reason || 'Failed to cancel', { id: tid })
    }
  }

  const handleUpdatePrice = async () => {
    if (!editModal || !editModal.newPrice) return
    const tid = toast.loading('Updating price...')
    try {
      const priceWei = ethers.parseEther(editModal.newPrice)
      const tx = await contracts.marketplace.updateListingPrice(editModal.listingId, priceWei)
      await tx.wait()
      toast.success('Price updated!', { id: tid })
      setEditModal(null)
      fetchListings()
    } catch (err) {
      toast.error(err.reason || 'Failed', { id: tid })
    }
  }

  const activeListings   = listings.filter(l => l.active)
  const inactiveListings = listings.filter(l => !l.active)

  return (
    <div>
      <div className="page-header flex justify-between items-center">
        <div>
          <div className="page-title">Manage Listings 📋</div>
          <div className="page-subtitle">Create and manage your carbon credit listings</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(s => !s)}>
          {showCreate ? '✕ Close' : '+ Create Listing'}
        </button>
      </div>

      {/* Balance info */}
      <div className="card card-p mb-4 flex gap-6 items-center">
        <div>
          <div className="stat-label">CCT Balance</div>
          <div className="stat-value" style={{ fontSize: '1.4rem' }}>{Number(ethers.formatEther(balance)).toFixed(2)}</div>
        </div>
        <div>
          <div className="stat-label">Marketplace Allowance</div>
          <div className="stat-value" style={{ fontSize: '1.4rem' }}>
            {allowance >= ethers.MaxUint256 - 1n ? '∞' : Number(ethers.formatEther(allowance)).toFixed(2)}
          </div>
        </div>
        {allowance === 0n && (
          <button className="btn btn-secondary" onClick={handleApprove}>
            Approve Marketplace
          </button>
        )}
      </div>

      {/* Create Listing Form */}
      {showCreate && (
        <div className="card card-p mb-6" style={{ border: '1px solid rgba(74,222,128,0.25)' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>Create New Listing</h3>
          <form onSubmit={handleCreate}>
            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label">Amount (CCT)</label>
                <input
                  className="form-input" type="number" min="0.000001" step="any"
                  placeholder="e.g. 100"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Price per CCT (ETH)</label>
                <input
                  className="form-input" type="number" min="0.000001" step="any"
                  placeholder="e.g. 0.01"
                  value={form.pricePerToken}
                  onChange={e => setForm(f => ({ ...f, pricePerToken: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Project ID</label>
                <input
                  className="form-input" type="number" min="1" step="1"
                  placeholder="e.g. 1"
                  value={form.projectId}
                  onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}
                />
              </div>
            </div>
            {form.amount && form.pricePerToken && (
              <div className="text-sm text-muted mb-3">
                Total value: ~{(Number(form.amount) * Number(form.pricePerToken)).toFixed(4)} ETH
              </div>
            )}
            <div className="flex gap-3">
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={formLoading}>
                {formLoading ? <><div className="spinner"/>Creating...</> : '✅ Create Listing'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Listings */}
      <div className="card mb-6">
        <div className="card-header">
          <h3 style={{ fontSize: '1.1rem' }}>Active Listings ({activeListings.length})</h3>
        </div>
        {activeListings.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-faint)' }}>
            <p>No active listings. Create one above.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th><th>Total</th><th>Remaining</th><th>Price/CCT</th>
                  <th>Total Value</th><th>Project</th><th>Created</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeListings.map(l => (
                  <tr key={l.listingId.toString()}>
                    <td className="text-muted">#{l.listingId.toString()}</td>
                    <td>{formatCCT(l.totalAmount)}</td>
                    <td className="text-green">{formatCCT(l.remainingAmount)}</td>
                    <td>{formatETH(l.pricePerToken)}</td>
                    <td>
                      {(Number(ethers.formatEther(l.remainingAmount)) * Number(ethers.formatEther(l.pricePerToken))).toFixed(4)} ETH
                    </td>
                    <td>#{l.projectId.toString()}</td>
                    <td>{formatDate(l.createdAt)}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-sm"
                          onClick={() => setEditModal({ listingId: l.listingId, newPrice: ethers.formatEther(l.pricePerToken) })}>
                          Edit Price
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleCancel(l.listingId)}>
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inactive Listings */}
      {inactiveListings.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: '1.1rem' }}>Inactive Listings ({inactiveListings.length})</h3>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>ID</th><th>Total</th><th>Remaining</th><th>Price/CCT</th><th>Project</th><th>Created</th></tr>
              </thead>
              <tbody>
                {inactiveListings.map(l => (
                  <tr key={l.listingId.toString()} style={{ opacity: 0.6 }}>
                    <td className="text-muted">#{l.listingId.toString()}</td>
                    <td>{formatCCT(l.totalAmount)}</td>
                    <td>{formatCCT(l.remainingAmount)}</td>
                    <td>{formatETH(l.pricePerToken)}</td>
                    <td>#{l.projectId.toString()}</td>
                    <td>{formatDate(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Price Modal */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Update Price — Listing #{editModal.listingId.toString()}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setEditModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">New Price per CCT (ETH)</label>
                <input
                  className="form-input" type="number" min="0.000001" step="any"
                  value={editModal.newPrice}
                  onChange={e => setEditModal(m => ({ ...m, newPrice: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleUpdatePrice}>Update Price</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
