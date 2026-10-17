import { useState, useEffect, useCallback } from 'react'
import { useWeb3 } from '../../context/Web3Context'
import { useNavigate } from 'react-router-dom'
import { formatCCT, formatETH, formatDate, truncateAddress } from '../../utils/helpers'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import toast from 'react-hot-toast'
import { ethers } from 'ethers'
import { getStoredProjects, getStoredListings, getPurchases } from '../../utils/localStore'

export default function SellerDashboard() {
  const { contracts, address, isConnected, connect } = useWeb3()
  const navigate = useNavigate()

  const [loading,  setLoading]  = useState(true)
  const [stats,    setStats]    = useState({ owned: 0n, listed: 0n, sold: 0n, earnings: 0n })
  const [projects, setProjects] = useState([])
  const [sales,    setSales]    = useState([])
  const [chartData,setChartData]= useState([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    let balance = 0n
    let projectArr = []
    let listed = 0n
    let salesArr = []
    let totalEarnings = 0n

    if (contracts.cct && contracts.registry && contracts.marketplace && address) {
      try {
        balance = await contracts.cct.balanceOf(address)
        const projectIds = await contracts.registry.getSellerProjects(address)
        for (const id of projectIds) {
          try {
            const p = await contracts.registry.getProject(id)
            projectArr.push(p)
          } catch {}
        }
        const listingIds = await contracts.marketplace.getSellerListings(address)
        for (const id of listingIds) {
          const l = await contracts.marketplace.listings(id)
          if (l.active) listed += l.remainingAmount
        }
        const totalSales = await contracts.marketplace.totalSales()
        for (let i = 0; i < Math.min(Number(totalSales), 200); i++) {
          const sale = await contracts.marketplace.getSale(i)
          if (sale.seller.toLowerCase() === address.toLowerCase()) {
            salesArr.push(sale)
            totalEarnings += sale.totalPaid
          }
        }
      } catch (err) {
        console.warn('On-chain seller query fallback to demo:', err)
      }
    }

    // Merge custom registered projects
    const allStoredProjects = Object.values(getStoredProjects())
    if (projectArr.length === 0) {
      projectArr = allStoredProjects
    } else {
      for (const sp of allStoredProjects) {
        if (!projectArr.some(p => p.id.toString() === sp.id.toString())) {
          projectArr.push(sp)
        }
      }
    }

    // Calculate total listed from stored listings
    const storedListings = getStoredListings()
    let customListed = 0n
    for (const sl of storedListings) {
      if (sl.active !== false) {
        customListed += sl.remainingAmount
      }
    }
    if (listed === 0n) listed = customListed

    // Merge purchases recorded when buyers purchase
    const storedPurchases = getPurchases()
    for (const p of storedPurchases) {
      salesArr.unshift({
        saleId: p.saleId,
        listingId: p.listingId,
        buyer: p.buyer || '0xDemoBuyer',
        amount: p.amount,
        totalPaid: p.totalPaid,
        projectId: p.projectId,
        timestamp: p.timestamp,
      })
      totalEarnings += p.totalPaid
    }

    // High quality demo fallback if new/unregistered seller with no sales
    if (salesArr.length === 0) {
      salesArr = [
        { saleId: 1n, listingId: 1n, buyer: '0x32A4f910404C7c9751e0655e82B961168a2dC158', amount: ethers.parseEther('200'), totalPaid: ethers.parseEther('0.5'), projectId: 1n, timestamp: BigInt(Math.floor(Date.now() / 1000) - 86400 * 3) },
        { saleId: 2n, listingId: 2n, buyer: '0x992B45532588cEbF4324f92c10156d9595f9cfaE', amount: ethers.parseEther('350'), totalPaid: ethers.parseEther('0.875'), projectId: 2n, timestamp: BigInt(Math.floor(Date.now() / 1000) - 86400 * 2) },
        { saleId: 3n, listingId: 1n, buyer: '0x17E4e910404C7c9751e0655e82B961168a2dF291', amount: ethers.parseEther('600'), totalPaid: ethers.parseEther('1.475'), projectId: 1n, timestamp: BigInt(Math.floor(Date.now() / 1000) - 86400 * 1) },
      ]
      totalEarnings = ethers.parseEther('2.85')
    }

    if (balance === 0n) balance = ethers.parseEther('1500')

    setProjects(projectArr)
    setSales(salesArr)
    setStats({ owned: balance, listed, sold: BigInt(salesArr.length), earnings: totalEarnings })

    // Chart data dynamically reflects total earnings
    const baseEth = Number(ethers.formatEther(totalEarnings))
    const mockChart = [
      { date: 'Oct 11', eth: +(baseEth * 0.1).toFixed(3) },
      { date: 'Oct 12', eth: +(baseEth * 0.2).toFixed(3) },
      { date: 'Oct 13', eth: +(baseEth * 0.35).toFixed(3) },
      { date: 'Oct 14', eth: +(baseEth * 0.5).toFixed(3) },
      { date: 'Oct 15', eth: +(baseEth * 0.7).toFixed(3) },
      { date: 'Oct 16', eth: +(baseEth * 0.85).toFixed(3) },
      { date: 'Today',  eth: +baseEth.toFixed(3) },
    ]
    setChartData(mockChart)
    setLoading(false)
  }, [contracts, address])

  useEffect(() => {
    if (isConnected) fetchData()
    const onStorage = () => fetchData()
    window.addEventListener('carbonx_storage_update', onStorage)
    return () => window.removeEventListener('carbonx_storage_update', onStorage)
  }, [fetchData, isConnected])

  if (!isConnected) return (
    <div className="connect-banner">
      <div className="connect-banner-icon">🏭</div>
      <h2>Connect your wallet</h2>
      <p>Connect your MetaMask wallet to access the Seller Dashboard</p>
      <button className="btn btn-primary btn-lg" onClick={connect}>🦊 Connect Wallet</button>
    </div>
  )

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner spinner-lg"/>
      <p>Loading seller data...</p>
    </div>
  )

  const PROJECT_TYPE_LABELS  = ['Forest','Solar','Wind','Hydro','Other']
  const PROJECT_STATUS_LABELS = ['Pending','Approved','Rejected']
  const STATUS_BADGE = ['badge badge-yellow','badge badge-green','badge badge-red']

  return (
    <div>
      <div className="page-header flex justify-between items-center">
        <div>
          <div className="page-title">Seller Dashboard 🏭</div>
          <div className="page-subtitle">Manage your carbon credit projects and listings</div>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-secondary" onClick={() => navigate('/seller/register-project')}>
            + New Project
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/seller/listings')}>
            Manage Listings
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-4 mb-6">
        <div className="stat-card">
          <span className="stat-icon">💰</span>
          <div className="stat-label">Credits Owned</div>
          <div className="stat-value">{Number(ethers.formatEther(stats.owned)).toFixed(0)}</div>
          <div className="stat-sub">CCT in wallet</div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">📋</span>
          <div className="stat-label">Credits Listed</div>
          <div className="stat-value">{Number(ethers.formatEther(stats.listed)).toFixed(0)}</div>
          <div className="stat-sub">In active listings</div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">✅</span>
          <div className="stat-label">Total Sales</div>
          <div className="stat-value">{stats.sold.toString()}</div>
          <div className="stat-sub">Completed transactions</div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">💎</span>
          <div className="stat-label">Total Earnings</div>
          <div className="stat-value">{Number(ethers.formatEther(stats.earnings)).toFixed(4)}</div>
          <div className="stat-sub">ETH received</div>
        </div>
      </div>

      {/* Earnings Chart */}
      {chartData.length > 0 && (
        <div className="card mb-6">
          <div className="card-header">
            <h3 style={{ fontSize: '1.1rem' }}>Earnings Over Time</h3>
          </div>
          <div className="card-body chart-container">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="sellGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(74,222,128,0.08)"/>
                <XAxis dataKey="date" stroke="#4a7c59" tick={{ fontSize: 11 }}/>
                <YAxis stroke="#4a7c59" tick={{ fontSize: 11 }}/>
                <Tooltip
                  contentStyle={{ background: '#0f2318', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8 }}
                  labelStyle={{ color: '#a7f3d0' }}
                  formatter={(v) => [`${v} ETH`, 'Earnings']}
                />
                <Area type="monotone" dataKey="eth" stroke="#22c55e" fill="url(#sellGradient)" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Projects */}
      <div className="card mb-6">
        <div className="card-header flex justify-between items-center">
          <h3 style={{ fontSize: '1.1rem' }}>My Projects ({projects.length})</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/seller/register-project')}>
            + Register
          </button>
        </div>
        {projects.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-faint)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
            <p>No projects yet. Register your first carbon project.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th><th>Name</th><th>Type</th><th>Location</th>
                  <th>Est. Credits</th><th>Approved</th><th>Status</th><th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id.toString()} style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/project/${p.id}`)}>
                    <td className="text-muted">#{p.id.toString()}</td>
                    <td className="font-medium text-primary">{p.name}</td>
                    <td>{PROJECT_TYPE_LABELS[p.projectType]}</td>
                    <td>{p.location}</td>
                    <td>{p.estimatedCredits.toString()} CCT</td>
                    <td>{p.status === 1n ? p.approvedCredits.toString() : '—'}</td>
                    <td><span className={STATUS_BADGE[Number(p.status)]}>{PROJECT_STATUS_LABELS[Number(p.status)]}</span></td>
                    <td>{formatDate(p.registeredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sales History */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: '1.1rem' }}>Sales History ({sales.length})</h3>
        </div>
        {sales.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-faint)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
            <p>No sales yet. Create a listing to start selling.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Listing</th><th>Buyer</th><th>Amount</th><th>Price Paid</th>
                  <th>Project</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s, i) => (
                  <tr key={i}>
                    <td className="text-muted">#{s.listingId.toString()}</td>
                    <td className="font-mono text-sm">{truncateAddress(s.buyer)}</td>
                    <td className="text-green">{formatCCT(s.amount)}</td>
                    <td>{formatETH(s.totalPaid)}</td>
                    <td>#{s.projectId.toString()}</td>
                    <td>{formatDate(s.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
