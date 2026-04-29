import { ArrowLeft, ExternalLink, FileText } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import FakePDF from './FakePDF'
import ParsedInvoiceView from './ParsedInvoiceView'
import ParseStatusBanner from './ParseStatusBanner'
import { VENDOR_STATUS, STATUS_HELP } from './VendorDashboard'

function vendorStatus(dbStatus) {
  return VENDOR_STATUS[dbStatus] || 'Submitted'
}

const TIMELINE_STEPS = ['Submitted', 'In Review', 'Approved', 'Paid']

function StatusTimeline({ currentStatus }) {
  const current = vendorStatus(currentStatus)
  const currentIdx = TIMELINE_STEPS.indexOf(current)

  return (
    <div className="flex items-center gap-0 w-full">
      {TIMELINE_STEPS.map((step, i) => {
        const isComplete = i < currentIdx
        const isCurrent = i === currentIdx
        const isUpcoming = i > currentIdx

        const dotColor = isComplete ? '#10B981'
          : isCurrent ? '#3B82F6'
          : 'var(--text-7)'

        const lineColor = isComplete ? '#10B981' : 'var(--border-strong)'

        return (
          <div key={step} className="flex items-center" style={{ flex: i < TIMELINE_STEPS.length - 1 ? 1 : 0 }}>
            {/* Step dot + label */}
            <div className="flex flex-col items-center" style={{ minWidth: '64px' }}>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{
                  backgroundColor: isComplete ? 'rgba(16,185,129,0.15)'
                    : isCurrent ? 'rgba(59,130,246,0.15)'
                    : 'var(--surface-alt)',
                  color: dotColor,
                  border: `2px solid ${dotColor}`,
                }}
              >
                {isComplete ? '✓' : i + 1}
              </div>
              <span className="text-xs mt-1.5 text-center font-medium" style={{
                color: isCurrent ? '#3B82F6' : isComplete ? '#10B981' : 'var(--text-6)',
              }}>
                {step}
              </span>
              {isCurrent && STATUS_HELP[step] && (
                <span className="text-xs mt-0.5 text-center" style={{ color: 'var(--text-5)', maxWidth: '120px' }}>
                  {STATUS_HELP[step]}
                </span>
              )}
            </div>

            {/* Connecting line */}
            {i < TIMELINE_STEPS.length - 1 && (
              <div className="flex-1 h-0.5 mx-1" style={{
                backgroundColor: lineColor,
                marginTop: STATUS_HELP[TIMELINE_STEPS[i]] && i === currentIdx ? '-24px' : '-20px',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function VendorInvoiceDetail({ invoice, onBack }) {
  const { isDark } = useTheme()

  const dateStr = invoice.created_at
    ? new Date(invoice.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—'

  const docType = invoice.document_type
    ? invoice.document_type.charAt(0).toUpperCase() + invoice.document_type.slice(1)
    : null

  return (
    <div className="p-6 fade-in max-w-5xl mx-auto">
      {/* Back button */}
      <button onClick={onBack}
        className="flex items-center gap-1.5 text-sm mb-4 transition-colors"
        style={{ color: 'var(--text-5)' }}>
        <ArrowLeft size={14} /> Back to My Invoices
      </button>

      {/* Status timeline */}
      <div className="rounded-lg p-5 mb-4"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
        <div className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-6)' }}>
          Invoice Status
        </div>
        <StatusTimeline currentStatus={invoice.status} />
      </div>

      {/* Two-column: metadata + PDF */}
      <div className="grid grid-cols-5 gap-4">
        {/* Left: metadata */}
        <div className="col-span-2 space-y-4">
          <ParseStatusBanner invoice={invoice} />
          <div className="rounded-lg overflow-hidden"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-alt)' }}>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-4)' }}>
                Invoice Details
              </span>
            </div>
            <div className="p-4">
              {[
                { label: 'Vendor', value: invoice.vendor_name },
                { label: 'Property', value: invoice.property_name },
                { label: 'Amount', value: invoice.amount != null ? `$${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—', big: true },
                { label: 'Invoice #', value: invoice.invoice_number },
                ...(docType ? [{ label: 'Document Type', value: docType }] : []),
                ...(invoice.invoice_date ? [{ label: 'Invoice Date', value: invoice.invoice_date }] : []),
                ...(invoice.due_date ? [{ label: 'Due Date', value: invoice.due_date }] : []),
                { label: 'Submitted', value: dateStr },
                ...(invoice.notes || invoice.description ? [{ label: 'Notes', value: invoice.notes || invoice.description }] : []),
              ].map((row, i) => (
                <div key={i} className="flex items-start justify-between py-2"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <span className="text-xs" style={{ color: 'var(--text-5)', minWidth: '90px' }}>{row.label}</span>
                  <span className="text-xs font-medium text-right"
                    style={{
                      color: row.big ? 'var(--text-1)' : 'var(--text-3)',
                      fontWeight: row.big ? 700 : 500,
                      fontSize: row.big ? '14px' : '12px',
                      maxWidth: '200px',
                      wordBreak: 'break-word',
                    }}>
                    {row.value || '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: PDF */}
        <div className="col-span-3">
          <div className="rounded-lg overflow-hidden"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center justify-between px-4 py-2.5"
              style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-alt)' }}>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-4)' }}>
                Document
              </span>
              {invoice.file_url && (
                <a href={invoice.file_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs" style={{ color: '#3B82F6' }}>
                  <ExternalLink size={11} /> Open PDF
                </a>
              )}
            </div>
            <div style={{ backgroundColor: isDark ? '#080F1C' : '#E8EDF5', minHeight: '500px' }}>
              {invoice.file_url ? (
                <iframe
                  src={invoice.file_url}
                  title="Invoice PDF"
                  className="w-full"
                  style={{ border: 'none', display: 'block', height: '65vh' }}
                />
              ) : invoice.source === 'upload' || invoice.parse_status ? (
                <div className="p-4">
                  <ParsedInvoiceView invoice={invoice} />
                </div>
              ) : invoice.vendor_name ? (
                <div className="p-4">
                  <FakePDF invoice={invoice} />
                </div>
              ) : (
                <div className="flex items-center justify-center p-12">
                  <div className="text-center">
                    <FileText size={32} style={{ color: 'var(--text-7)', margin: '0 auto 8px' }} />
                    <p className="text-sm" style={{ color: 'var(--text-5)' }}>No document preview available</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
