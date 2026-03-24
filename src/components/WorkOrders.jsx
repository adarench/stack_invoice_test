import { workOrders } from '../data/mockData'
import { ClipboardList, CheckCircle, Clock, AlertTriangle } from 'lucide-react'

const PRIORITY_CONFIG = {
  Critical: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
  High:     { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  Medium:   { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)' },
  Low:      { color: '#6B7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.3)' },
}

const STATUS_CONFIG = {
  Completed:   { color: '#6EE7B7', bg: 'rgba(16,185,129,0.12)', dot: '#10B981' },
  Open:        { color: '#FCD34D', bg: 'rgba(245,158,11,0.12)', dot: '#F59E0B' },
  'In Progress': { color: '#93C5FD', bg: 'rgba(59,130,246,0.12)', dot: '#3B82F6' },
}

export default function WorkOrders() {
  const completed = workOrders.filter(w => w.status === 'Completed')
  const open = workOrders.filter(w => w.status !== 'Completed')

  return (
    <div className="p-6 fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            Work Orders
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-5)' }}>
            {workOrders.length} total · {open.length} open · {completed.length} completed
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium"
          style={{ backgroundColor: '#1D4ED8', color: 'white' }}
        >
          <ClipboardList size={13} />
          New Work Order
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total', value: workOrders.length, color: 'var(--text-4)' },
          { label: 'Open', value: open.length, color: '#FCD34D' },
          { label: 'Completed', value: completed.length, color: '#6EE7B7' },
          { label: 'Avg Variance', value: '+12%', color: '#FCA5A5', sub: 'Actual vs Estimated' },
        ].map((s, i) => (
          <div
            key={i}
            className="rounded-lg p-3 themed"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
          >
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-6)' }}>{s.label}</div>
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            {s.sub && <div className="text-xs mt-0.5" style={{ color: 'var(--text-6)' }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Open work orders */}
      {open.length > 0 && (
        <section className="mb-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: '#FCD34D' }}>
            <Clock size={12} />
            Open Work Orders
          </h2>
          <div className="space-y-2">
            {open.map(wo => <WorkOrderCard key={wo.id} wo={wo} />)}
          </div>
        </section>
      )}

      {/* Completed */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: '#6EE7B7' }}>
          <CheckCircle size={12} />
          Completed
        </h2>
        <div
          className="rounded-lg overflow-hidden themed"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-alt)' }}>
                {['Work Order', 'Description', 'Property', 'Vendor', 'Est. Cost', 'Actual', 'Variance', 'Status'].map(col => (
                  <th
                    key={col}
                    className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-6)' }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {completed.map((wo, i) => {
                const variance = wo.actual_cost
                  ? ((wo.actual_cost - wo.estimated_cost) / wo.estimated_cost * 100).toFixed(0)
                  : null

                return (
                  <tr
                    key={wo.id}
                    className="transition-colors cursor-pointer"
                    style={{ borderBottom: i < completed.length - 1 ? '1px solid var(--border)' : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--hover-xs)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-medium" style={{ color: '#60A5FA' }}>{wo.id}</span>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <div className="text-sm truncate" style={{ color: 'var(--text-3)' }}>{wo.description}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-6)' }}>
                        Completed {wo.completed}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-4)' }}>{wo.property}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-4)' }}>{wo.vendor}</td>
                    <td className="px-4 py-3 text-sm tabular-nums" style={{ color: 'var(--text-4)' }}>
                      ${wo.estimated_cost.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold tabular-nums" style={{ color: 'var(--text-1)' }}>
                      {wo.actual_cost ? `$${wo.actual_cost.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {variance !== null && (
                        <span
                          className="text-xs font-semibold"
                          style={{
                            color: Number(variance) > 20 ? '#FCA5A5' : Number(variance) > 5 ? '#FCD34D' : '#6EE7B7',
                          }}
                        >
                          {Number(variance) >= 0 ? '+' : ''}{variance}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded"
                        style={STATUS_CONFIG[wo.status]}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_CONFIG[wo.status]?.dot }} />
                        {wo.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function WorkOrderCard({ wo }) {
  const priority = PRIORITY_CONFIG[wo.priority] || PRIORITY_CONFIG.Low

  return (
    <div
      className="rounded-lg p-4 themed"
      style={{ backgroundColor: 'var(--surface)', border: `1px solid ${priority.border}`, boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-medium" style={{ color: '#60A5FA' }}>{wo.id}</span>
            <span
              className="text-xs px-1.5 py-0.5 rounded font-medium"
              style={{ backgroundColor: priority.bg, color: priority.color, border: `1px solid ${priority.border}` }}
            >
              {wo.priority}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={STATUS_CONFIG[wo.status]}
            >
              {wo.status}
            </span>
          </div>
          <div className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>{wo.description}</div>
          <div className="flex items-center gap-4 mt-1.5 text-xs" style={{ color: 'var(--text-5)' }}>
            <span>{wo.property}</span>
            <span>·</span>
            <span>{wo.vendor}</span>
            <span>·</span>
            <span>Est. ${wo.estimated_cost.toLocaleString()}</span>
            <span>·</span>
            <span>Created {wo.created}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
