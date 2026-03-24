import { useState } from 'react'
import { ArrowLeft, CheckCircle, AlertTriangle, Clock, ExternalLink, Zap, X, Loader } from 'lucide-react'
import StatusBadge from './StatusBadge'
import FakePDF from './FakePDF'
import { useTheme } from '../context/ThemeContext'

export default function InvoiceDetail({ invoice, onAction, onBack }) {
  const { isDark } = useTheme()
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showFlagModal, setShowFlagModal] = useState(false)
  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(false)
  const [note, setNote] = useState('')

  const handleApprove = () => {
    setApproving(true)
    setTimeout(() => {
      onAction(invoice.id, 'approve', { note: note || 'Approved via OpsFlow' })
      setApproving(false)
      setApproved(true)
      setTimeout(() => { setShowApproveModal(false); setApproved(false); setNote('') }, 1200)
    }, 1400)
  }

  const handleFlag = () => {
    onAction(invoice.id, 'flag', { note: note || 'Flagged for manual review' })
    setShowFlagModal(false)
    setNote('')
  }

  const isApproved = ['Approved', 'Payment Scheduled', 'Paid'].includes(invoice.status)
  const isFlagged = invoice.status === 'Flagged'
  const canAct = invoice.status === 'Awaiting Approval' || invoice.status === 'Under Review'
  const insights = invoice.ai_insights

  return (
    <div className="flex flex-col h-full fade-in" style={{ minHeight: '100%' }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 px-6 py-3 flex-shrink-0 themed"
        style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: 'var(--text-5)' }}>
          <ArrowLeft size={13} /> Invoices
        </button>
        <span style={{ color: 'var(--text-7)' }}>/</span>
        <span className="font-mono text-sm" style={{ color: '#3B82F6' }}>{invoice.id}</span>
        <StatusBadge status={invoice.status} />
        {invoice.risk_flag && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium"
            style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
            <AlertTriangle size={10} /> Risk Flag Active
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-5)' }}>AI Confidence:</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded"
            style={{
              backgroundColor: invoice.ai_confidence >= 90
                ? 'rgba(16,185,129,0.12)' : invoice.ai_confidence >= 70
                ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
              color: invoice.ai_confidence >= 90 ? (isDark ? '#6EE7B7' : '#065F46')
                : invoice.ai_confidence >= 70 ? (isDark ? '#FCD34D' : '#92400E')
                : (isDark ? '#FCA5A5' : '#991B1B'),
            }}>
            {invoice.ai_confidence}%
          </span>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — PDF (60%) */}
        <div className="flex-shrink-0 overflow-y-auto p-6 themed"
          style={{ width: '60%', borderRight: '1px solid var(--border)', backgroundColor: isDark ? '#080F1C' : '#E8EDF5' }}>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-6)' }}>
              Original Document
            </span>
            <button className="flex items-center gap-1 text-xs" style={{ color: '#3B82F6' }}>
              <ExternalLink size={11} /> Open original
            </button>
          </div>
          <FakePDF invoice={invoice} />
        </div>

        {/* Right — panels (40%) */}
        <div className="flex-1 overflow-y-auto themed" style={{ backgroundColor: 'var(--bg)' }}>
          <div className="p-5 space-y-4">

            {/* Extracted Data */}
            <div className="rounded-lg overflow-hidden themed"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-center gap-2 px-4 py-2.5 themed"
                style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-alt)' }}>
                <Zap size={12} style={{ color: '#60A5FA' }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-4)' }}>
                  Extracted Data
                </span>
                <span className="ml-auto text-xs" style={{ color: 'var(--text-6)' }}>Auto-extracted</span>
              </div>
              <div className="p-4">
                {[
                  { label: 'Vendor',        value: invoice.vendor_name },
                  { label: 'Property',      value: invoice.property_name },
                  { label: 'Building',      value: invoice.building },
                  { label: 'Amount',        value: `$${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, big: true },
                  { label: 'Invoice Type',  value: invoice.invoice_type },
                  { label: 'GL Code',       value: invoice.gl_code },
                  { label: 'Invoice Date',  value: invoice.invoice_date },
                  { label: 'Due Date',      value: invoice.due_date },
                  ...(invoice.linked_work_order ? [{ label: 'Work Order', value: invoice.linked_work_order, accent: true }] : []),
                ].map((row, i) => (
                  <div key={i} className="flex items-start justify-between py-2"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <span className="text-xs" style={{ color: 'var(--text-5)', minWidth: '90px' }}>{row.label}</span>
                    <span className="text-xs font-medium text-right"
                      style={{
                        color: row.big ? 'var(--text-1)' : row.accent ? '#3B82F6' : 'var(--text-3)',
                        fontWeight: row.big ? 700 : 500,
                        fontSize: row.big ? '14px' : '12px',
                      }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Insights */}
            <div className="rounded-lg overflow-hidden"
              style={{
                border: insights.match_status === 'warning'
                  ? '1px solid rgba(245,158,11,0.35)'
                  : isDark ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(5,150,105,0.3)',
                background: insights.match_status === 'warning'
                  ? 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(239,68,68,0.04))'
                  : 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(59,130,246,0.04))',
              }}>
              <div className="flex items-center gap-2 px-4 py-2.5"
                style={{ borderBottom: insights.match_status === 'warning' ? '1px solid rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.15)' }}>
                <Zap size={12} style={{ color: insights.match_status === 'warning' ? '#F59E0B' : '#10B981' }} />
                <span className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: insights.match_status === 'warning' ? (isDark ? '#FCD34D' : '#92400E') : (isDark ? '#6EE7B7' : '#065F46') }}>
                  AI Insights
                </span>
                <span className="ml-auto text-xs px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: insights.match_status === 'warning' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                    color: insights.match_status === 'warning' ? (isDark ? '#FCD34D' : '#92400E') : (isDark ? '#6EE7B7' : '#065F46'),
                    fontSize: '10px',
                  }}>
                  {insights.match_status === 'warning' ? 'Review Required' : 'Verified'}
                </span>
              </div>
              <div className="p-4 space-y-3">
                {/* Match */}
                <div className="flex items-start gap-2 rounded-md p-2.5"
                  style={{ backgroundColor: insights.match_status === 'warning' ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)' }}>
                  {insights.match_status === 'warning'
                    ? <AlertTriangle size={13} style={{ color: '#F59E0B', flexShrink: 0, marginTop: '1px' }} />
                    : <CheckCircle size={13} style={{ color: '#10B981', flexShrink: 0, marginTop: '1px' }} />
                  }
                  <span className="text-xs"
                    style={{ color: insights.match_status === 'warning' ? (isDark ? '#FCD34D' : '#92400E') : (isDark ? '#A7F3D0' : '#065F46') }}>
                    {insights.match_label}
                  </span>
                </div>

                {/* Budget */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs" style={{ color: 'var(--text-5)' }}>Budget Utilization</span>
                    <span className="text-xs font-semibold"
                      style={{ color: invoice.budget_used >= 85 ? '#EF4444' : invoice.budget_used >= 70 ? '#F59E0B' : '#10B981' }}>
                      {invoice.budget_used}% used
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(127,127,127,0.15)' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{
                      width: `${invoice.budget_used}%`,
                      backgroundColor: invoice.budget_used >= 85 ? '#EF4444' : invoice.budget_used >= 70 ? '#F59E0B' : '#10B981',
                    }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs" style={{ color: 'var(--text-6)' }}>${invoice.budget_spent?.toLocaleString()} spent</span>
                    <span className="text-xs" style={{ color: 'var(--text-6)' }}>${invoice.budget_total?.toLocaleString()} budget</span>
                  </div>
                  <p className="text-xs mt-1.5"
                    style={{ color: invoice.budget_used >= 85 ? '#EF4444' : '#10B981' }}>
                    {insights.budget_message}
                  </p>
                </div>

                {/* Expected range */}
                <div className="flex items-center justify-between py-2 px-2.5 rounded"
                  style={{ backgroundColor: 'rgba(127,127,127,0.06)' }}>
                  <span className="text-xs" style={{ color: 'var(--text-5)' }}>Expected range</span>
                  <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--text-4)' }}>
                    ${insights.expected_cost_low?.toLocaleString()} – ${insights.expected_cost_high?.toLocaleString()}
                  </span>
                </div>

                {/* Risk message */}
                {insights.risk_message && (
                  <div className="rounded-md p-3"
                    style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={12} style={{ color: '#EF4444', flexShrink: 0, marginTop: '1px' }} />
                      <div>
                        <div className="text-xs font-semibold mb-1" style={{ color: isDark ? '#FCA5A5' : '#991B1B' }}>
                          Anomaly Detected
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: isDark ? '#FCA5A5' : '#991B1B', opacity: 0.9 }}>
                          {insights.risk_message}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Confidence breakdown */}
                <div>
                  <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-5)' }}>Match Confidence</div>
                  <div className="space-y-1.5">
                    {insights.confidence_breakdown?.map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: 'var(--text-5)', minWidth: '130px' }}>{item.label}</span>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(127,127,127,0.15)' }}>
                          <div className="h-full rounded-full" style={{
                            width: `${item.score}%`,
                            backgroundColor: item.score >= 90 ? '#10B981' : item.score >= 50 ? '#F59E0B' : '#EF4444',
                          }} />
                        </div>
                        <span className="text-xs tabular-nums font-medium"
                          style={{
                            color: item.score >= 90 ? '#10B981' : item.score >= 50 ? '#F59E0B' : '#EF4444',
                            minWidth: '28px', textAlign: 'right',
                          }}>
                          {item.score}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="rounded-lg p-4 themed"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
              <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-5)' }}>
                Actions
              </div>

              {isApproved && !isFlagged && (
                <div className="flex items-center gap-2 p-3 rounded-md text-sm"
                  style={{ backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: isDark ? '#6EE7B7' : '#065F46' }}>
                  <CheckCircle size={14} />
                  Invoice {invoice.status === 'Paid' ? 'paid and filed' : invoice.status.toLowerCase()}
                </div>
              )}
              {isFlagged && (
                <div className="flex items-center gap-2 p-3 rounded-md text-sm mb-3"
                  style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: isDark ? '#FCA5A5' : '#991B1B' }}>
                  <AlertTriangle size={14} /> Flagged — pending manual review
                </div>
              )}
              {(canAct || isFlagged) && (
                <div className="flex flex-col gap-2">
                  <button onClick={() => setShowApproveModal(true)}
                    className="w-full py-2 rounded-md text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-2"
                    style={{ backgroundColor: '#059669', color: 'white' }}>
                    <CheckCircle size={14} /> Approve Invoice
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setShowFlagModal(true)}
                      className="py-2 rounded-md text-sm font-medium flex items-center justify-center gap-1.5 transition-colors"
                      style={{ border: '1px solid rgba(239,68,68,0.4)', color: isDark ? '#FCA5A5' : '#991B1B', backgroundColor: 'rgba(239,68,68,0.08)' }}>
                      <AlertTriangle size={13} /> Flag
                    </button>
                    <button onClick={() => onAction(invoice.id, 'request_review')}
                      className="py-2 rounded-md text-sm font-medium flex items-center justify-center gap-1.5 transition-colors"
                      style={{ border: '1px solid var(--border-strong)', color: 'var(--text-4)', backgroundColor: 'transparent' }}>
                      <Clock size={13} /> Request Review
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mini audit */}
            <div className="rounded-lg overflow-hidden themed"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
              <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-5)' }}>
                  Activity Log
                </span>
              </div>
              <div className="p-4">
                <div className="relative">
                  <div className="absolute left-2 top-2 bottom-2 w-px" style={{ backgroundColor: 'var(--border)' }} />
                  <div className="space-y-4 pl-6">
                    {invoice.audit.map((entry, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-4 w-2 h-2 rounded-full border" style={{
                          backgroundColor: i === invoice.audit.length - 1 ? '#3B82F6' : 'var(--border)',
                          borderColor: i === invoice.audit.length - 1 ? '#3B82F6' : 'var(--border-strong)',
                          top: '3px',
                        }} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>{entry.event}</span>
                            <span className="text-xs" style={{ color: 'var(--text-6)' }}>·</span>
                            <span className="text-xs" style={{ color: 'var(--text-5)' }}>{entry.user}</span>
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--text-5)' }}>{entry.note}</div>
                          <div className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-7)', fontSize: '10px' }}>{entry.timestamp}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Approve Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget && !approving) setShowApproveModal(false) }}>
          <div className="w-full max-w-md rounded-xl overflow-hidden fade-in themed"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="font-semibold" style={{ color: 'var(--text-1)' }}>Approve Invoice</h3>
              {!approving && (
                <button onClick={() => setShowApproveModal(false)}>
                  <X size={16} style={{ color: 'var(--text-5)' }} />
                </button>
              )}
            </div>
            {approved ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ backgroundColor: 'rgba(16,185,129,0.15)' }}>
                  <CheckCircle size={24} style={{ color: '#10B981' }} />
                </div>
                <p className="font-semibold" style={{ color: '#10B981' }}>Invoice Approved</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-5)' }}>Status updated successfully</p>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface-alt)', border: '1px solid var(--border)' }}>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span style={{ color: 'var(--text-5)' }}>Vendor</span><br /><span className="font-medium" style={{ color: 'var(--text-2)' }}>{invoice.vendor_name}</span></div>
                    <div><span style={{ color: 'var(--text-5)' }}>Amount</span><br /><span className="font-bold" style={{ color: 'var(--text-1)' }}>${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
                    <div><span style={{ color: 'var(--text-5)' }}>Property</span><br /><span className="font-medium" style={{ color: 'var(--text-2)' }}>{invoice.property_name}</span></div>
                    <div><span style={{ color: 'var(--text-5)' }}>GL Code</span><br /><span className="font-medium text-xs" style={{ color: 'var(--text-4)' }}>{invoice.gl_code.split('—')[0].trim()}</span></div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-4)' }}>
                    Approval note (optional)
                  </label>
                  <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                    placeholder="Add context for the approval record…"
                    className="w-full rounded-md px-3 py-2 text-sm outline-none resize-none"
                    style={{ backgroundColor: 'var(--surface-alt)', border: '1px solid var(--border-strong)', color: 'var(--text-2)' }} />
                </div>
                <button onClick={handleApprove} disabled={approving}
                  className="w-full py-2.5 rounded-md font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                  style={{ backgroundColor: '#059669', color: 'white', opacity: approving ? 0.9 : 1 }}>
                  {approving ? <><Loader size={14} className="spin-slow" /> Processing…</> : <><CheckCircle size={14} /> Confirm Approval</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Flag Modal */}
      {showFlagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowFlagModal(false) }}>
          <div className="w-full max-w-md rounded-xl overflow-hidden fade-in themed"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid rgba(239,68,68,0.3)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="font-semibold flex items-center gap-2" style={{ color: isDark ? '#FCA5A5' : '#991B1B' }}>
                <AlertTriangle size={15} /> Flag for Review
              </h3>
              <button onClick={() => setShowFlagModal(false)}><X size={16} style={{ color: 'var(--text-5)' }} /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm" style={{ color: 'var(--text-4)' }}>
                This invoice will be escalated for manual review. Please describe the concern below.
              </p>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                placeholder="Describe why this invoice is being flagged…"
                className="w-full rounded-md px-3 py-2 text-sm outline-none resize-none"
                style={{ backgroundColor: 'var(--surface-alt)', border: '1px solid var(--border-strong)', color: 'var(--text-2)' }} />
              <button onClick={handleFlag}
                className="w-full py-2.5 rounded-md font-semibold text-sm flex items-center justify-center gap-2"
                style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: isDark ? '#FCA5A5' : '#991B1B', border: '1px solid rgba(239,68,68,0.4)' }}>
                <AlertTriangle size={14} /> Confirm Flag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
