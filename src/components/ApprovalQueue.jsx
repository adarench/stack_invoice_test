import { useState } from 'react'
import { AlertTriangle, CheckCircle, Clock, ChevronRight, Loader } from 'lucide-react'
import StatusBadge from './StatusBadge'

export default function ApprovalQueue({ invoices, onSelectInvoice, onAction }) {
  const [processing, setProcessing] = useState(null)

  const queue = invoices.filter(i =>
    i.status === 'Awaiting Approval' || i.status === 'Flagged' || i.status === 'Under Review'
  )

  const flagged = queue.filter(i => i.risk_flag)
  const normal = queue.filter(i => !i.risk_flag && i.status === 'Awaiting Approval')
  const review = queue.filter(i => i.status === 'Under Review')

  const handleQuickApprove = (e, inv) => {
    e.stopPropagation()
    setProcessing(inv.id)
    setTimeout(() => {
      onAction(inv.id, 'approve')
      setProcessing(null)
    }, 1200)
  }

  return (
    <div className="p-6 fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            Approval Queue
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-5)' }}>
            {queue.length} invoice{queue.length !== 1 ? 's' : ''} pending your review
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded text-xs"
            style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <AlertTriangle size={12} />
            {flagged.length} flagged
          </div>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded text-xs"
            style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.2)' }}
          >
            <Clock size={12} />
            {normal.length} awaiting
          </div>
        </div>
      </div>

      {queue.length === 0 ? (
        <div
          className="rounded-lg p-16 text-center themed"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <CheckCircle size={32} className="mx-auto mb-3" style={{ color: '#10B981' }} />
          <p className="font-semibold" style={{ color: 'var(--text-2)' }}>Queue is clear</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-5)' }}>All invoices have been processed</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Flagged — top priority */}
          {flagged.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={13} style={{ color: '#EF4444' }} />
                <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#EF4444' }}>
                  Risk Flagged — Requires Attention
                </h2>
              </div>
              <div className="space-y-2">
                {flagged.map(inv => (
                  <InvoiceRow
                    key={inv.id}
                    inv={inv}
                    priority="high"
                    processing={processing === inv.id}
                    onSelect={() => onSelectInvoice(inv)}
                    onApprove={(e) => handleQuickApprove(e, inv)}
                    onFlag={(e) => { e.stopPropagation(); onAction(inv.id, 'flag') }}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Under review */}
          {review.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Clock size={13} style={{ color: '#60A5FA' }} />
                <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#60A5FA' }}>
                  Under Review
                </h2>
              </div>
              <div className="space-y-2">
                {review.map(inv => (
                  <InvoiceRow
                    key={inv.id}
                    inv={inv}
                    priority="medium"
                    processing={processing === inv.id}
                    onSelect={() => onSelectInvoice(inv)}
                    onApprove={(e) => handleQuickApprove(e, inv)}
                    onFlag={(e) => { e.stopPropagation(); onAction(inv.id, 'flag') }}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Normal queue */}
          {normal.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Clock size={13} style={{ color: 'var(--text-4)' }} />
                <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-5)' }}>
                  Awaiting Approval
                </h2>
              </div>
              <div className="space-y-2">
                {normal.map(inv => (
                  <InvoiceRow
                    key={inv.id}
                    inv={inv}
                    priority="normal"
                    processing={processing === inv.id}
                    onSelect={() => onSelectInvoice(inv)}
                    onApprove={(e) => handleQuickApprove(e, inv)}
                    onFlag={(e) => { e.stopPropagation(); onAction(inv.id, 'flag') }}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function InvoiceRow({ inv, priority, processing, onSelect, onApprove, onFlag }) {
  const borderColor = priority === 'high'
    ? 'rgba(239,68,68,0.3)'
    : priority === 'medium'
    ? 'rgba(59,130,246,0.25)'
    : 'var(--border)'

  return (
    <div
      onClick={onSelect}
      className="rounded-lg p-4 cursor-pointer transition-all duration-150 themed"
      style={{
        backgroundColor: 'var(--surface)',
        border: `1px solid ${borderColor}`,
        background: priority === 'high'
          ? 'linear-gradient(135deg, rgba(239,68,68,0.04), var(--surface))'
          : 'var(--surface)',
        boxShadow: 'var(--shadow-card)',
      }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-alt)'}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--surface)'}
    >
      <div className="flex items-start gap-4">
        {/* Left: invoice info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <span className="font-mono text-xs font-medium" style={{ color: '#60A5FA' }}>{inv.id}</span>
            <StatusBadge status={inv.status} />
            {inv.risk_flag && (
              <span
                className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
                style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#FCA5A5', fontSize: '10px' }}
              >
                <AlertTriangle size={9} />
                {inv.ai_insights.risk_message?.slice(0, 50)}…
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>{inv.vendor_name}</div>
              <div className="text-xs" style={{ color: 'var(--text-5)' }}>{inv.property_name} · {inv.building}</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold tabular-nums" style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
                {inv.amount != null ? `$${Number(inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-5)' }}>Due {inv.due_date}</div>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-xs" style={{ color: 'var(--text-5)' }}>
              GL: <span style={{ color: 'var(--text-4)' }}>{inv.gl_code.split('—')[0].trim()}</span>
            </span>
            {inv.linked_work_order && (
              <span className="text-xs" style={{ color: 'var(--text-5)' }}>
                WO: <span style={{ color: '#60A5FA' }}>{inv.linked_work_order}</span>
              </span>
            )}
            <span className="text-xs" style={{ color: 'var(--text-5)' }}>
              AI: <span style={{
                color: inv.ai_confidence >= 90 ? '#6EE7B7' : inv.ai_confidence >= 70 ? '#FCD34D' : '#FCA5A5'
              }}>
                {inv.ai_confidence}% extraction confidence
              </span>
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="h-1.5 w-20 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-subtle)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${inv.budget_used}%`,
                    backgroundColor: inv.budget_used >= 85 ? '#EF4444' : inv.budget_used >= 70 ? '#F59E0B' : '#10B981',
                  }}
                />
              </div>
              <span className="text-xs" style={{
                color: inv.budget_used >= 85 ? '#FCA5A5' : inv.budget_used >= 70 ? '#FCD34D' : '#6EE7B7'
              }}>
                {inv.budget_used}% budget
              </span>
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={onApprove}
            disabled={processing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all"
            style={{
              backgroundColor: '#059669',
              color: 'white',
              opacity: processing ? 0.8 : 1,
            }}
          >
            {processing ? (
              <><Loader size={11} className="spin-slow" /> Processing…</>
            ) : (
              <><CheckCircle size={11} /> Approve</>
            )}
          </button>
          <button
            onClick={onFlag}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
            style={{
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#FCA5A5',
              backgroundColor: 'rgba(239,68,68,0.08)',
            }}
          >
            <AlertTriangle size={11} />
            Flag
          </button>
          <button
            onClick={() => {}}
            className="p-1.5 rounded transition-colors"
            style={{ color: 'var(--text-6)' }}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
