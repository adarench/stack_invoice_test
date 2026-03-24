import { useState } from 'react'
import { Filter, Clock, CheckCircle, AlertTriangle, Zap, CreditCard, FileText, Archive } from 'lucide-react'

const EVENT_CONFIG = {
  'Uploaded':         { icon: FileText,    color: '#6B7280', bg: 'rgba(107,114,128,0.15)' },
  'Processing':       { icon: Zap,         color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  'Classified':       { icon: Zap,         color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  'Linked':           { icon: CheckCircle, color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  'Routed':           { icon: Clock,       color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  'Approved':         { icon: CheckCircle, color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  'Anomaly Detected': { icon: AlertTriangle, color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
  'Flagged':          { icon: AlertTriangle, color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
  'Risk Detected':    { icon: AlertTriangle, color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
  'Payment Scheduled':{ icon: CreditCard,  color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
  'Paid':             { icon: CreditCard,  color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  'Filed':            { icon: Archive,     color: '#6B7280', bg: 'rgba(107,114,128,0.15)' },
  'Review Requested': { icon: Clock,       color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
}

export default function AuditTrailView({ invoices, onSelectInvoice }) {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('all')

  const allEvents = invoices
    .flatMap(inv =>
      inv.audit.map(entry => ({
        ...entry,
        invoice_id: inv.id,
        vendor: inv.vendor_name,
        amount: inv.amount,
        invoice: inv,
      }))
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  const filteredEvents = selectedInvoiceId === 'all'
    ? allEvents
    : allEvents.filter(e => e.invoice_id === selectedInvoiceId)

  return (
    <div className="p-6 fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            Audit Trail
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-5)' }}>
            Complete activity log — {allEvents.length} events across {invoices.length} invoices
          </p>
        </div>
      </div>

      <div className="flex gap-5">
        {/* Timeline */}
        <div className="flex-1">
          {/* Filter bar */}
          <div
            className="flex items-center gap-3 mb-4 p-3 rounded-lg themed"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
          >
            <Filter size={13} style={{ color: 'var(--text-6)' }} />
            <span className="text-xs" style={{ color: 'var(--text-5)' }}>Filter by invoice:</span>
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setSelectedInvoiceId('all')}
                className="px-2.5 py-1 rounded text-xs font-medium transition-colors"
                style={{
                  backgroundColor: selectedInvoiceId === 'all' ? 'rgba(59,130,246,0.2)' : 'transparent',
                  color: selectedInvoiceId === 'all' ? '#60A5FA' : 'var(--text-5)',
                  border: selectedInvoiceId === 'all' ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                }}
              >
                All
              </button>
              {invoices.map(inv => (
                <button
                  key={inv.id}
                  onClick={() => setSelectedInvoiceId(inv.id)}
                  className="px-2.5 py-1 rounded text-xs font-medium transition-colors font-mono"
                  style={{
                    backgroundColor: selectedInvoiceId === inv.id ? 'rgba(59,130,246,0.2)' : 'transparent',
                    color: selectedInvoiceId === inv.id ? '#60A5FA' : 'var(--text-5)',
                    border: selectedInvoiceId === inv.id ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                  }}
                >
                  {inv.id}
                </button>
              ))}
            </div>
          </div>

          {/* Timeline events */}
          <div
            className="rounded-lg overflow-hidden themed"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
          >
            <div className="p-5">
              <div className="relative">
                {/* Vertical line */}
                <div
                  className="absolute top-2 bottom-2"
                  style={{ left: '15px', width: '1px', backgroundColor: 'var(--border-subtle)' }}
                />

                <div className="space-y-0">
                  {filteredEvents.map((event, i) => {
                    const cfg = EVENT_CONFIG[event.event] || EVENT_CONFIG['Uploaded']
                    const Icon = cfg.icon
                    const isLast = i === filteredEvents.length - 1

                    return (
                      <div
                        key={`${event.invoice_id}-${i}`}
                        className="relative flex gap-4"
                        style={{ paddingBottom: isLast ? 0 : '20px' }}
                      >
                        {/* Icon node */}
                        <div
                          className="relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.color}40` }}
                        >
                          <Icon size={13} style={{ color: cfg.color }} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pb-1" style={{ paddingTop: '4px' }}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
                                  {event.event}
                                </span>
                                {selectedInvoiceId === 'all' && (
                                  <button
                                    onClick={() => onSelectInvoice(event.invoice)}
                                    className="font-mono text-xs"
                                    style={{ color: '#3B82F6' }}
                                  >
                                    {event.invoice_id}
                                  </button>
                                )}
                                <span className="text-xs" style={{ color: 'var(--text-6)' }}>
                                  by {event.user}
                                </span>
                              </div>
                              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-5)' }}>
                                {event.note}
                              </p>
                              {selectedInvoiceId === 'all' && (
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-6)' }}>
                                  {event.vendor} · ${event.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </p>
                              )}
                            </div>
                            <span
                              className="text-xs flex-shrink-0 font-mono"
                              style={{ color: 'var(--text-7)', fontSize: '11px', paddingTop: '2px' }}
                            >
                              {event.timestamp}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats sidebar */}
        <div className="w-56 flex-shrink-0 space-y-4">
          <div
            className="rounded-lg p-4 themed"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
          >
            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-5)' }}>
              Event Summary
            </div>
            {[
              { label: 'Total Events', value: allEvents.length, color: 'var(--text-4)' },
              { label: 'AI Actions', value: allEvents.filter(e => e.user === 'OpsFlow AI').length, color: '#60A5FA' },
              { label: 'Human Actions', value: allEvents.filter(e => e.user !== 'OpsFlow AI' && e.user !== 'System').length, color: '#A78BFA' },
              { label: 'System Actions', value: allEvents.filter(e => e.user === 'System').length, color: 'var(--text-5)' },
              { label: 'Anomalies', value: allEvents.filter(e => e.event.includes('Anomaly') || e.event === 'Flagged').length, color: '#FCA5A5' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1.5" style={{ borderBottom: i < 4 ? '1px solid var(--border-subtle)' : 'none' }}>
                <span className="text-xs" style={{ color: 'var(--text-5)' }}>{item.label}</span>
                <span className="text-sm font-bold tabular-nums" style={{ color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>

          <div
            className="rounded-lg p-4 themed"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
          >
            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-5)' }}>
              By Invoice
            </div>
            {invoices.map(inv => (
              <button
                key={inv.id}
                onClick={() => { setSelectedInvoiceId(inv.id); onSelectInvoice(inv) }}
                className="w-full text-left mb-2 p-2 rounded transition-colors item-hover"
                style={{ backgroundColor: 'var(--surface-alt)' }}
              >
                <div className="font-mono text-xs" style={{ color: '#60A5FA' }}>{inv.id}</div>
                <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-5)' }}>{inv.vendor_name}</div>
                <div className="text-xs" style={{ color: 'var(--text-6)' }}>{inv.audit.length} events</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
