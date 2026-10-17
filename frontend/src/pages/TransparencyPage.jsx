import { useState, useEffect, useCallback } from 'react'
import { useWeb3 } from '../context/Web3Context'
import { formatCCT, formatETH, formatDate, truncateAddress } from '../utils/helpers'
import { ethers } from 'ethers'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts'

export default function TransparencyPage() {
  const { contracts } = useWeb3()

  const [loading,    setLoading]    = useState(true)
  const [stats,      setStats]      = useState({ issued: 0n, retired: 0n, projects: 0n, listings: 0n, sales: 0n })
  const [events,     setEvents]     = useState([])
  const [chartData,  setChartData]  = useState([])

  const fetchData = useCallback(async () => {
    if (!contracts.cct && !contracts.marketplace) return
    setLoading(true)
    try {
      const results = await Promise.allSettled([
        contracts.cct?.totalIssued(),
        contracts.cct?.totalRetired(),
        contracts.registry?.totalProjects(),
        contracts.marketplace?.totalListings(),
        contracts.marketplace?.totalSales(),
      ])

      const [issued, retired, projects, listings, sales] = results.map(r =>
        r.status === 'fulfilled' ? r.value : 0n
      )
      setStats({ issued, retired, projects, listings, sales })

      // Fetch recent events: last 20 sales
      if (contracts.marketplace) {
        const totalSales = await contracts.marketplace.totalSales()
        const eventArr = []
        const start = Math.max(0, Number(totalSales) - 20)
        for (let i = Number(totalSales) - 1; i >= start; i--) {
          const sale = await contracts.marketplace.getSale(i)
          eventArr.push({ type: 'Sale', ...sale })
        }
        setEvents(eventArr)

        // Build chart: group sales by date
        const allSales = []
        for (let i = 0; i < Math.min(Number(totalSales), 100); i++) {
          allSales.push(await contracts.marketplace.getSale(i))
        }
        const dailyMap = {}
        for (const sale of allSales) {
          const d = new Date(Number(sale.timestamp) * 1000)
          const key = `${d.getMonth()+1}/${d.getDate()}`
          if (!dailyMap[key]) dailyMap[key] = { date: key, credits: 0, volume: 0 }
          dailyMap[key].credits += Number(ethers.formatEther(sale.amount))
          dailyMap[key].volume  += Number(ethers.formatEther(sale.totalPaid))
        }
        setChartData(Object.values(dailyMap))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [contracts])

  useEffect(() => { fetchData() }, [fetchData])

  const retirePct = stats.issued > 0n
    ? Math.round(Number(stats.retired) * 100 / Number(stats.issued))
    : 0

  return (
    <div>
      <div className="page-header">
        <div className="page-title">🔍 Transparency Dashboard</div>
        <div className="page-subtitle">
          Real-time on-chain data — every credit issued, traded, and retired is recorded on Ethereum
        </div>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner spinner-lg"/><p>Loading on-chain data...</p></div>
      ) : (
        <>
          {/* Hero Stats */}
          <div className="grid-4 mb-6">
            <div className="stat-card" style={{ borderTop: '2px solid var(--green-500)' }}>
              <span className="stat-icon">🌳</span>
              <div className="stat-label">Credits Issued</div>
              <div className="stat-value">{Number(ethers.formatEther(stats.issued)).toFixed(0)}</div>
              <div className="stat-sub">Total CCT minted</div>
            </div>
            <div className="stat-card" style={{ borderTop: '2px solid #10b981' }}>
              <span className="stat-icon">🔥</span>
              <div className="stat-label">Credits Retired</div>
              <div className="stat-value">{Number(ethers.formatEther(stats.retired)).toFixed(0)}</div>
              <div className="stat-sub">Permanently burned</div>
            </div>
            <div className="stat-card" style={{ borderTop: '2px solid #3b82f6' }}>
              <span className="stat-icon">💱</span>
              <div className="stat-label">Total Trades</div>
              <div className="stat-value">{stats.sales.toString()}</div>
              <div className="stat-sub">On-chain sales</div>
            </div>
            <div className="stat-card" style={{ borderTop: '2px solid #8b5cf6' }}>
              <span className="stat-icon">📋</span>
              <div className="stat-label">Total Projects</div>
              <div className="stat-value">{stats.projects.toString()}</div>
              <div className="stat-sub">Registered globally</div>
            </div>
          </div>

          {/* Retirement progress */}
          <div className="card card-p mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 style={{ fontSize: '1.1rem' }}>Global Retirement Rate</h3>
              <span className="badge badge-green">{retirePct}% offset</span>
            </div>
            <div className="progress-bar" style={{ height: 14, marginBottom: '0.5rem' }}>
              <div className="progress-fill" style={{ width: `${retirePct}%` }}/>
            </div>
            <div className="flex justify-between text-xs text-faint">
              <span>{Number(ethers.formatEther(stats.retired)).toFixed(0)} CCT retired</span>
              <span>{Number(ethers.formatEther(stats.issued)).toFixed(0)} CCT total issued</span>
            </div>
          </div>

          {/* Charts */}
          {chartData.length > 0 && (
            <div className="grid-2 mb-6">
              <div className="card">
                <div className="card-header"><h3 style={{ fontSize: '1rem' }}>Credits Traded (Daily)</h3></div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="tranGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(74,222,128,0.08)"/>
                      <XAxis dataKey="date" stroke="#4a7c59" tick={{ fontSize: 10 }}/>
                      <YAxis stroke="#4a7c59" tick={{ fontSize: 10 }}/>
                      <Tooltip
                        contentStyle={{ background: '#0f2318', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8 }}
                        formatter={v => [`${v.toFixed(2)} CCT`]}
                      />
                      <Area type="monotone" dataKey="credits" stroke="#22c55e" fill="url(#tranGrad)" strokeWidth={2}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="card">
                <div className="card-header"><h3 style={{ fontSize: '1rem' }}>Trading Volume (ETH)</h3></div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(74,222,128,0.08)"/>
                      <XAxis dataKey="date" stroke="#4a7c59" tick={{ fontSize: 10 }}/>
                      <YAxis stroke="#4a7c59" tick={{ fontSize: 10 }}/>
                      <Tooltip
                        contentStyle={{ background: '#0f2318', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8 }}
                        formatter={v => [`${v.toFixed(4)} ETH`]}
                      />
                      <Bar dataKey="volume" fill="#10b981" radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Live Event Feed */}
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <div>
                <h3 style={{ fontSize: '1.1rem' }}>Live On-Chain Event Feed</h3>
                <div className="text-xs text-faint mt-1">Most recent transactions on the CarbonX platform</div>
              </div>
              <div className="flex gap-2 items-center">
                <span className="event-dot" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}/>
                <span className="text-xs text-green">Live</span>
              </div>
            </div>
            {events.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-faint)' }}>
                No on-chain events yet. Transactions will appear here in real time.
              </div>
            ) : (
              <div>
                {events.map((ev, i) => (
                  <div key={i} className="event-item">
                    <div className="event-dot"/>
                    <div style={{ flex: 1 }}>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="badge badge-green" style={{ marginRight: '0.5rem', fontSize: '0.7rem' }}>
                            Sale
                          </span>
                          <span className="text-sm font-medium">
                            {Number(ethers.formatEther(ev.amount)).toFixed(2)} CCT
                          </span>
                          <span className="text-sm text-muted"> traded for </span>
                          <span className="text-sm font-medium">
                            {Number(ethers.formatEther(ev.totalPaid)).toFixed(4)} ETH
                          </span>
                        </div>
                        <span className="text-xs text-faint">{formatDate(ev.timestamp)}</span>
                      </div>
                      <div className="text-xs text-faint mt-1">
                        Buyer: <span className="font-mono">{truncateAddress(ev.buyer)}</span>
                        {' · '}
                        Project #{ev.projectId.toString()}
                        {' · '}
                        Listing #{ev.listingId.toString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
