import { useState } from 'react'
import { CreditCard, Building2, CheckCircle, Loader, ChevronRight, Calendar } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { useTheme } from '../context/ThemeContext'

export default function PaymentScreen({ invoices, onAction, onSelectInvoice }) {
  const [selectedMethod, setSelectedMethod] = useState({})
  const [processing, setProcessing] = useState(null)
  const [processed, setProcessed] = useState({})

  const readyForPayment = invoices.filter(i => i.status === 'Approved')
  const scheduled = invoices.filter(i => i.status === 'Payment Scheduled')
  const recentlyPaid = invoices.filter(i => i.status === 'Paid')

  const getMethod = (id) => selectedMethod[id] || 'ACH'

  const handleSchedule = (inv) => {
    const method = getMethod(inv.id)
    const date = method === 'ACH' ? '2024-02-01' : '2024-02-05'
    onAction(inv.id, 'schedule_payment', { method, date })
  }

  const handleProcess = (inv) => {
    setProcessing(inv.id)
    setTimeout(() => {
      const method = getMethod(inv.id)
      const ref = method === 'ACH'
        ? `ACH-2024-${String(Math.floor(Math.random() * 9000 + 1000))}`
        : `CHK-${String(Math.floor(Math.random() * 90000 + 10000))}`
      onAction(inv.id, 'process_payment', { method, ref })
      setProcessing(null)
      setProcessed(p => ({ ...p, [inv.id]: true }))
    }, 2000)
  }

  const totalScheduled = scheduled.reduce((s, i) => s + i.amount, 0)
  const totalReady = readyForPayment.reduce((s, i) => s + i.amount, 0)

  return (
    <div className="p-6 fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            Payments
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-5)' }}>
            Manage disbursements and payment scheduling
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="px-3 py-1.5 rounded text-xs"
            style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.2)' }}
          >
            ${totalReady.toLocaleString('en-US', { minimumFractionDigits: 2 })} ready to schedule
          </div>
          <div
            className="px-3 py-1.5 rounded text-xs"
            style={{ backgroundColor: 'rgba(139,92,246,0.1)', color: '#C4B5FD', border: '1px solid rgba(139,92,246,0.2)' }}
          >
            ${totalScheduled.toLocaleString('en-US', { minimumFractionDigits: 2 })} scheduled
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {/* Ready for scheduling */}
        {readyForPayment.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--text-4)' }}>
              <CreditCard size={12} />
              Approved — Schedule Payment
            </h2>
            <div className="space-y-3">
              {readyForPayment.map(inv => (
                <PaymentCard
                  key={inv.id}
                  inv={inv}
                  method={getMethod(inv.id)}
                  onMethodChange={(m) => setSelectedMethod(p => ({ ...p, [inv.id]: m }))}
                  onSchedule={() => handleSchedule(inv)}
                  onSelect={() => onSelectInvoice(inv)}
                  action="schedule"
                />
              ))}
            </div>
          </section>
        )}

        {/* Scheduled — process now */}
        {scheduled.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: '#8B5CF6' }}>
              <Calendar size={12} />
              Scheduled — Ready to Process
            </h2>
            <div className="space-y-3">
              {scheduled.map(inv => (
                <PaymentCard
                  key={inv.id}
                  inv={inv}
                  method={getMethod(inv.id)}
                  onMethodChange={(m) => setSelectedMethod(p => ({ ...p, [inv.id]: m }))}
                  onProcess={() => handleProcess(inv)}
                  onSelect={() => onSelectInvoice(inv)}
                  processing={processing === inv.id}
                  justProcessed={processed[inv.id]}
                  action="process"
                />
              ))}
            </div>
          </section>
        )}

        {/* Recently paid */}
        {recentlyPaid.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: '#10B981' }}>
              <CheckCircle size={12} />
              Recently Paid
            </h2>
            <div
              className="rounded-lg overflow-hidden themed"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
            >
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-alt)' }}>
                    {['Invoice', 'Vendor', 'Amount', 'Method', 'Status'].map(col => (
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
                  {recentlyPaid.map((inv, i) => {
                    const payEvent = inv.audit.find(e => e.event === 'Paid')
                    return (
                      <tr
                        key={inv.id}
                        onClick={() => onSelectInvoice(inv)}
                        className="cursor-pointer transition-colors"
                        style={{ borderBottom: i < recentlyPaid.length - 1 ? '1px solid var(--border)' : 'none' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--hover-xs)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs" style={{ color: '#60A5FA' }}>{inv.id}</span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-2)' }}>
                          {inv.vendor_name}
                        </td>
                        <td className="px-4 py-3 font-semibold text-sm tabular-nums" style={{ color: 'var(--text-1)' }}>
                          {inv.amount != null ? `$${Number(inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="text-xs px-2 py-0.5 rounded"
                            style={{ backgroundColor: 'rgba(107,114,128,0.12)', color: 'var(--text-4)' }}
                          >
                            {payEvent?.note?.includes('ACH') ? 'ACH' : payEvent?.note?.includes('Check') ? 'Check' : 'ACH'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={inv.status} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {readyForPayment.length === 0 && scheduled.length === 0 && recentlyPaid.length === 0 && (
          <div
            className="rounded-lg p-16 text-center themed"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <CheckCircle size={32} className="mx-auto mb-3" style={{ color: '#10B981' }} />
            <p className="font-semibold" style={{ color: 'var(--text-2)' }}>No pending payments</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-5)' }}>Approve invoices to queue them for payment</p>
          </div>
        )}
      </div>
    </div>
  )
}

function PaymentCard({ inv, method, onMethodChange, onSchedule, onProcess, onSelect, processing, justProcessed, action }) {
  const { isDark } = useTheme()
  const [batchState, setBatchState] = useState(null)

  const handleAction = (e) => {
    e.stopPropagation()
    if (action === 'schedule') {
      setBatchState('scheduling')
      setTimeout(() => {
        onSchedule()
        setBatchState(null)
      }, 900)
    } else {
      onProcess()
    }
  }

  return (
    <div
      className="rounded-lg p-4 cursor-pointer transition-all duration-150 themed"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
      onClick={onSelect}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-strong)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-xs" style={{ color: '#60A5FA' }}>{inv.id}</span>
            <StatusBadge status={inv.status} />
          </div>
          <div className="flex items-start justify-between">
            <div>
              <div className="font-semibold text-sm" style={{ color: 'var(--text-2)' }}>{inv.vendor_name}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-5)' }}>{inv.property_name} · {inv.building}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-6)' }}>
                {inv.gl_code} · Due {inv.due_date}
              </div>
            </div>
            <div className="text-right ml-4">
              <div className="text-xl font-bold tabular-nums" style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
                {inv.amount != null ? `$${Number(inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Payment method + action */}
        <div className="flex items-center gap-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {/* Method selector */}
          <div className="flex rounded-md overflow-hidden" style={{ border: '1px solid var(--border-strong)' }}>
            {['ACH', 'Check'].map(m => (
              <button
                key={m}
                onClick={() => onMethodChange(m)}
                className="px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5"
                style={{
                  backgroundColor: method === m
                      ? (isDark ? '#1E3A5F' : 'rgba(37,99,235,0.1)')
                      : 'transparent',
                  color: method === m
                      ? (isDark ? '#60A5FA' : '#2563EB')
                      : 'var(--text-5)',
                }}
              >
                {m === 'ACH' ? <Building2 size={11} /> : <CreditCard size={11} />}
                {m}
              </button>
            ))}
          </div>

          {/* Action button */}
          {action === 'schedule' && (
            <button
              onClick={handleAction}
              disabled={!!batchState}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all"
              style={{ backgroundColor: '#7C3AED', color: 'white' }}
            >
              {batchState ? (
                <><Loader size={11} className="spin-slow" /> Scheduling…</>
              ) : (
                <><Calendar size={11} /> Schedule</>
              )}
            </button>
          )}

          {action === 'process' && (
            <button
              onClick={handleAction}
              disabled={processing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all"
              style={{
                backgroundColor: justProcessed ? '#059669' : '#1D4ED8',
                color: 'white',
              }}
            >
              {processing ? (
                <><Loader size={11} className="spin-slow" /> Processing…</>
              ) : justProcessed ? (
                <><CheckCircle size={11} /> Sent!</>
              ) : (
                <>Process {method}</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
