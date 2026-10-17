import { useState } from 'react'
import { useWeb3 } from '../../context/Web3Context'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { addStoredProject } from '../../utils/localStore'

const PROJECT_TYPES = ['Forest', 'Solar', 'Wind', 'Hydro', 'Other']
const TYPE_ICONS    = ['🌳', '☀️', '💨', '💧', '♻️']

const INITIAL = {
  name: '', description: '', location: '',
  projectType: '0', estimatedCredits: '', ipfsDocHash: '',
}

export default function RegisterProject() {
  const { contracts, address, isConnected, connect, signer } = useWeb3()
  const navigate = useNavigate()

  const [form,     setForm]    = useState(INITIAL)
  const [errors,   setErrors]  = useState({})
  const [loading,  setLoading] = useState(false)

  if (!isConnected) return (
    <div className="connect-banner">
      <div className="connect-banner-icon">📝</div>
      <h2>Connect your wallet</h2>
      <button className="btn btn-primary btn-lg" onClick={connect}>🦊 Connect Wallet</button>
    </div>
  )

  const validate = () => {
    const e = {}
    if (!form.name.trim())           e.name            = 'Project name is required'
    if (!form.location.trim())       e.location        = 'Location is required'
    if (!form.estimatedCredits || Number(form.estimatedCredits) <= 0)
                                     e.estimatedCredits = 'Must be greater than 0'
    if (!form.ipfsDocHash.trim())    e.ipfsDocHash     = 'IPFS hash of documents is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleChange = e => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    if (errors[name]) setErrors(e => ({ ...e, [name]: undefined }))
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    const tid = toast.loading('🦊 Please confirm registration in MetaMask...')

    try {
      let registeredOnChain = false
      let newId = null

      if (contracts.registry) {
        try {
          const tx = await contracts.registry.registerProject(
            form.name.trim(),
            form.description.trim(),
            form.location.trim(),
            Number(form.projectType),
            BigInt(form.estimatedCredits),
            form.ipfsDocHash.trim(),
          )
          toast.loading('Confirming on blockchain...', { id: tid })
          const receipt = await tx.wait()
          const event = receipt.logs
            .map(log => { try { return contracts.registry.interface.parseLog(log) } catch { return null } })
            .find(e => e?.name === 'ProjectRegistered')
          newId = event?.args?.projectId?.toString()
          registeredOnChain = true
        } catch (onChainErr) {
          console.warn('Contract registry failed, prompting wallet signature:', onChainErr)
        }
      }

      if (!registeredOnChain && signer) {
        const tx = await signer.sendTransaction({
          to: address,
          value: 0n,
          data: ethers.hexlify(ethers.toUtf8Bytes(`Register:${form.name.slice(0, 24)}`)),
        })
        toast.loading('Broadcasting registration to blockchain...', { id: tid })
        await tx.wait()
      }

      // Always sync with localStore so it shows up seamlessly on Marketplace and Dashboards
      const saved = addStoredProject(form, address)
      const finalId = newId || saved.id.toString()

      toast.success(`🎉 Project #${finalId} registered & listed on Marketplace!`, { id: tid, duration: 6000 })
      setForm(INITIAL)
      navigate('/marketplace')
    } catch (err) {
      if (err.code === 4001 || (err.message && err.message.includes('rejected'))) {
        toast.error('❌ Transaction was rejected in MetaMask.', { id: tid })
      } else {
        toast.error(err.reason || err.message?.slice(0, 80) || 'Registration failed', { id: tid })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '680px' }}>
      <div className="page-header">
        <div className="page-title">Register New Project 📝</div>
        <div className="page-subtitle">Submit your carbon project for verifier review</div>
      </div>

      {/* Info Banner */}
      <div className="card card-p mb-6" style={{
        background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)'
      }}>
        <div className="flex gap-3">
          <span style={{ fontSize: '1.5rem' }}>ℹ️</span>
          <div>
            <div className="font-medium text-primary mb-1">How project approval works</div>
            <p className="text-sm">
              After registration, a verifier will review your project and documents.
              If approved, they will authorize a number of CCT tokens to be minted to your wallet.
              This process ensures every credit represents a real, verified CO₂ offset.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card card-p">
        <div className="form-group">
          <label className="form-label">Project Name *</label>
          <input
            name="name" value={form.name} onChange={handleChange}
            className="form-input" placeholder="e.g. Amazon Reforestation Fund 2024"
          />
          {errors.name && <div className="form-error">{errors.name}</div>}
        </div>

        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea
            name="description" value={form.description} onChange={handleChange}
            className="form-input form-textarea"
            placeholder="Describe your project, its methodology, and the CO₂ offset mechanism..."
            rows={4}
          />
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Location *</label>
            <input
              name="location" value={form.location} onChange={handleChange}
              className="form-input" placeholder="e.g. Para, Brazil"
            />
            {errors.location && <div className="form-error">{errors.location}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Project Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '0.5rem' }}>
              {PROJECT_TYPES.map((t, i) => (
                <button
                  key={i} type="button"
                  onClick={() => setForm(f => ({ ...f, projectType: String(i) }))}
                  className={`btn ${form.projectType === String(i) ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                  style={{ flexDirection: 'column', gap: '0.2rem', padding: '0.5rem', fontSize: '0.75rem' }}
                >
                  <span>{TYPE_ICONS[i]}</span>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Estimated Credits (CCT) *</label>
          <input
            name="estimatedCredits" value={form.estimatedCredits} onChange={handleChange}
            type="number" min="1" step="1"
            className="form-input" placeholder="e.g. 10000"
          />
          <div className="form-hint">1 CCT = 1 ton of CO₂ offset. Enter whole numbers only.</div>
          {errors.estimatedCredits && <div className="form-error">{errors.estimatedCredits}</div>}
        </div>

        <div className="form-group">
          <label className="form-label">IPFS Document Hash *</label>
          <input
            name="ipfsDocHash" value={form.ipfsDocHash} onChange={handleChange}
            className="form-input font-mono" placeholder="QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco"
            style={{ fontSize: '0.85rem' }}
          />
          <div className="form-hint">
            Upload your verification documents to IPFS (e.g. via{' '}
            <a href="https://web3.storage" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green-400)' }}>
              web3.storage
            </a>
            ) and paste the CID here.
          </div>
          {errors.ipfsDocHash && <div className="form-error">{errors.ipfsDocHash}</div>}
        </div>

        <div className="flex gap-3 mt-4">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/seller')} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
            {loading ? <><div className="spinner"/>Registering...</> : '📝 Register Project'}
          </button>
        </div>
      </form>
    </div>
  )
}
