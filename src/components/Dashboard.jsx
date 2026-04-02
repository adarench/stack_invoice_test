import { AlertTriangle, CheckCircle, Clock, TrendingUp, ArrowRight, FileText } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { useTheme } from '../context/ThemeContext'
import { normalizeWorkflowStatus } from '../data/demoUsers'

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

function TypeBadge({ type }) {
  const { isDark } = useTheme()
  const colors = isDark
    ? {
        'Work Order': { bg: 'rgba(59,130,246,0.12)',   color: '#93C5FD', border: 'rgba(59,130,246,0.25)' },
        'Contract':   { bg: 'rgba(139,92,246,0.12)',   color: '#C4B5FD', border: 'rgba(139,92,246,0.25)' },
        'Utility':    { bg: 'rgba(107,114,128,0.12)',  color: '#9CA3AF', border: 'rgba(107,114,128,0.25)' },
      }
    : {
        'Work Order': { bg: 'rgba(37,99,235,0.1)',     color: '#1D4ED8', border: 'rgba(37,99,235,0.25)' },
        'Contract':   { bg: 'rgba(109,40,217,0.1)',    color: '#5B21B6', border: 'rgba(109,40,217,0.25)' },
        'Utility':    { bg: 'rgba(100,116,139,0.1)',   color: '#475569', border: 'rgba(100,116,139,0.25)' },
      }
  const c = colors[type] || colors['Utility']
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {type}
    </span>
  )
}

export default function Dashboard({ invoices, onSelectInvoice, setActiveView }) {
  const { isDark } = useTheme()
  const pending = invoices.filter(i => {
    const s = normalizeWorkflowStatus(i.status)
    return s === 'uploaded' || s === 'in_review'
  })
  const processedToday = invoices.filter(i => {
    const s = normalizeWorkflowStatus(i.status)
    return s === 'approved' || s === 'paid'
  })
  const riskFlags = invoices.filter(i => i.risk_flag)
  const totalPendingValue = pending.reduce((s, i) => s + i.amount, 0)

  const activityFeed = [
    { id: 1, icon: '🔵', text: 'HVAC Solutions invoice INV-2024-0201 processed', sub: '$8,450 — Riverside Commons', time: '4 min ago', color: '#3B82F6' },
    { id: 2, icon: '✅', text: 'Test User approved INV-2024-0196', sub: '$2,200 — GreenScape Services (Landscaping)', time: '2 hrs ago', color: '#10B981' },
    { id: 3, icon: '⚠️', text: 'Anomaly detected on INV-2024-0204', sub: 'Snow removal $3,800 — no weather data support', time: '3 hrs ago', color: '#F59E0B' },
    { id: 4, icon: '💳', text: 'Payment processed — Austin Energy', sub: '$1,847.23 — ACH completed', time: 'Jan 15', color: '#10B981' },
    { id: 5, icon: '📋', text: 'WO-2024-0847 marked complete', sub: 'HVAC compressor replacement — Riverside Commons', time: 'Jan 12', color: '#6B7280' },
    { id: 6, icon: '✅', text: 'INV-2024-0192 approved', sub: '$1,265 — QuickFix Plumbing Co.', time: 'Jan 7', color: '#10B981' },
  ]

  const statCards = [
    {
      label: 'Pending Approvals', value: pending.length,
      sub: `${fmt(totalPendingValue)} total value`,
      icon: Clock, color: '#F59E0B',
      bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)',
      action: () => setActiveView('approvals'),
    },
    {
      label: 'Processed Today', value: processedToday.length,
      sub: `${fmt(processedToday.reduce((s, i) => s + i.amount, 0))} processed`,
      icon: CheckCircle, color: '#10B981',
      bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)',
      action: () => setActiveView('invoices'),
    },
    {
      label: 'Budget Alerts', value: riskFlags.length,
      sub: riskFlags.length > 0 ? 'Requires manual review' : 'No active alerts',
      icon: AlertTriangle,
      color: riskFlags.length > 0 ? '#EF4444' : '#6B7280',
      bg: riskFlags.length > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(107,114,128,0.08)',
      border: riskFlags.length > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(107,114,128,0.2)',
      action: () => setActiveView('invoices'),
    },
  ]

  const budgetOverview = [
    { label: 'Repairs & Maintenance', spent: 10800, budget: 15000, pct: 72 },
    { label: 'Utilities',             spent: 24900, budget: 48000, pct: 52 },
    { label: 'Landscaping & Grounds', spent: 4400,  budget: 26400, pct: 18 },
    { label: 'Snow Removal',          spent: 4450,  budget: 5000,  pct: 89 },
  ]

  return (
    <div className="p-6 space-y-6 fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            Operations Dashboard
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-5)' }}>
            Tuesday, January 16, 2024 — Premier Properties
          </p>
        </div>
        <button
          onClick={() => setActiveView('invoices')}
          className="flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors"
          style={{
            backgroundColor: isDark ? '#1E3A5F' : 'rgba(37,99,235,0.1)',
            color: isDark ? '#60A5FA' : '#2563EB',
            border: '1px solid rgba(59,130,246,0.3)',
          }}
        >
          <FileText size={13} />
          View All Invoices
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon
          return (
            <button
              key={i}
              onClick={card.action}
              className="text-left rounded-lg p-4 transition-all duration-200 hover:scale-[1.01] themed"
              style={{ backgroundColor: card.bg, border: `1px solid ${card.border}`, boxShadow: 'var(--shadow-card)' }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-5)' }}>
                    {card.label}
                  </p>
                  <p className="text-3xl font-bold" style={{ color: card.color, letterSpacing: '-0.03em' }}>
                    {card.value}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-5)' }}>{card.sub}</p>
                </div>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: card.border }}>
                  <Icon size={15} style={{ color: card.color }} />
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Activity feed — 2 cols */}
        <div className="col-span-2 rounded-lg themed"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>Activity Feed</h2>
            <button className="text-xs font-medium flex items-center gap-1"
              style={{ color: '#3B82F6' }}
              onClick={() => setActiveView('audit')}>
              View all <ArrowRight size={11} />
            </button>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {activityFeed.map((item) => (
              <div key={item.id} className="flex gap-3 px-4 py-3 row-hover cursor-pointer">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: `${item.color}22` }}>
                  <span style={{ fontSize: '11px' }}>{item.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: 'var(--text-3)' }}>{item.text}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-5)' }}>{item.sub}</p>
                </div>
                <span className="text-xs flex-shrink-0 mt-0.5" style={{ color: 'var(--text-6)' }}>{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Risk Flags */}
          <div className="rounded-lg themed"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-2)' }}>
                <AlertTriangle size={13} style={{ color: '#EF4444' }} />
                Risk Flags
              </h2>
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#FCA5A5', fontSize: '10px' }}>
                {riskFlags.length} active
              </span>
            </div>
            {riskFlags.length === 0 ? (
              <div className="px-4 py-5 text-center">
                <CheckCircle size={20} className="mx-auto mb-2" style={{ color: '#10B981' }} />
                <p className="text-sm" style={{ color: 'var(--text-5)' }}>No active risk flags</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {riskFlags.map(inv => (
                  <button key={inv.id} onClick={() => onSelectInvoice(inv)}
                    className="w-full text-left px-4 py-3 row-hover transition-colors">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: '#FCA5A5' }}>{inv.vendor_name}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-5)' }}>
                        {inv.id} · {inv.amount != null ? `$${Number(inv.amount).toLocaleString()}` : '—'}
                      </p>
                      <p className="text-xs mt-1" style={{ color: '#F59E0B', fontSize: '11px' }}>
                        ⚠ {inv.ai_insights.risk_message?.slice(0, 60)}…
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Budget overview */}
          <div className="rounded-lg themed"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-2)' }}>
                <TrendingUp size={13} style={{ color: '#60A5FA' }} />
                Budget Utilization
              </h2>
            </div>
            <div className="px-4 py-3 space-y-3">
              {budgetOverview.map((b, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: 'var(--text-4)' }}>{b.label}</span>
                    <span className="text-xs font-semibold"
                      style={{ color: b.pct >= 85 ? '#EF4444' : b.pct >= 70 ? '#F59E0B' : '#10B981' }}>
                      {b.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{
                      width: `${b.pct}%`,
                      backgroundColor: b.pct >= 85 ? '#EF4444' : b.pct >= 70 ? '#F59E0B' : '#10B981',
                    }} />
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-6)' }}>
                    ${b.spent.toLocaleString()} of ${b.budget.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent invoices */}
      <div className="rounded-lg themed"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>Recent Invoices</h2>
          <button onClick={() => setActiveView('invoices')}
            className="text-xs flex items-center gap-1 font-medium" style={{ color: '#3B82F6' }}>
            View all <ArrowRight size={11} />
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-alt)' }}>
              {['Invoice', 'Vendor', 'Property', 'Amount', 'Type', 'Status'].map(col => (
                <th key={col} className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-6)' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.slice(0, 4).map((inv) => (
              <tr key={inv.id} onClick={() => onSelectInvoice(inv)}
                className="cursor-pointer row-hover"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs" style={{ color: '#60A5FA' }}>{inv.id}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>{inv.vendor_name}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm" style={{ color: 'var(--text-4)' }}>{inv.property_name}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-1)' }}>
                    {inv.amount != null ? `$${Number(inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                  </span>
                </td>
                <td className="px-4 py-3"><TypeBadge type={inv.invoice_type} /></td>
                <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
