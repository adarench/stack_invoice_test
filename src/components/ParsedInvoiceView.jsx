/**
 * ParsedInvoiceView
 *
 * Renders the actual parsed invoice data for uploaded PDFs.
 * Shown in InvoiceDetail when file_url is not available (mock/local mode)
 * but the invoice was parsed from a real PDF upload.
 *
 * Never shows hardcoded placeholder data.
 */

const NA = <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Needs review</span>

function field(value) {
  if (value === null || value === undefined || value === '') return NA
  return value
}

function money(value) {
  if (value === null || value === undefined) return NA
  return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

export default function ParsedInvoiceView({ invoice }) {
  const lineItems = invoice.line_items || []
  const glSplits = Array.isArray(invoice.gl_splits) ? invoice.gl_splits : []
  const parseMethodLabel = invoice.parse_method === 'llm_pdf'
    ? 'Vision fallback'
    : invoice.parse_method === 'text+llm_pdf'
      ? 'Text + vision fallback'
      : 'Parsed from upload'

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        backgroundColor: '#FAFAF8',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        color: '#1a1a1a',
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        minHeight: '600px',
      }}
    >
      {/* Toolbar chrome */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: '#3C4043', borderBottom: '1px solid #2a2a2a' }}>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#FF5F56' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#FFBD2E' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#27C93F' }} />
        </div>
        <div className="flex-1 mx-3 px-3 py-0.5 rounded text-xs text-center"
          style={{ backgroundColor: '#2a2a2a', color: '#9CA3AF', fontFamily: 'monospace' }}>
          {invoice.invoice_number ? `Invoice-${invoice.invoice_number}.pdf` : invoice.id}
        </div>
        <span className="text-xs px-2 py-0.5 rounded font-medium"
          style={{ backgroundColor: 'rgba(16,185,129,0.2)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)' }}>
          {parseMethodLabel}
        </span>
      </div>

      {/* Document */}
      <div className="p-8" style={{ backgroundColor: '#FAFAF8' }}>
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="text-xl font-bold mb-1" style={{ color: '#1a1a1a', letterSpacing: '-0.03em' }}>
              {field(invoice.vendor_name)}
            </div>
            {/* No hardcoded address — only show if we have it */}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold mb-2" style={{ color: '#1a1a1a', letterSpacing: '-0.03em' }}>
              INVOICE
            </div>
            <table className="text-xs ml-auto">
              <tbody>
                <tr>
                  <td className="pr-4 font-medium text-right" style={{ color: '#6B7280' }}>Invoice #</td>
                  <td className="font-semibold" style={{ color: '#1a1a1a' }}>{field(invoice.invoice_number)}</td>
                </tr>
                <tr>
                  <td className="pr-4 font-medium text-right" style={{ color: '#6B7280' }}>Date</td>
                  <td style={{ color: '#1a1a1a' }}>{field(invoice.invoice_date)}</td>
                </tr>
                <tr>
                  <td className="pr-4 font-medium text-right" style={{ color: '#6B7280' }}>Due Date</td>
                  <td className="font-semibold" style={{ color: '#DC2626' }}>{field(invoice.due_date)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Bill To / Service Location */}
        <div className="grid grid-cols-2 gap-8 mb-7 pb-7" style={{ borderBottom: '1px solid #E5E7EB' }}>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9CA3AF' }}>Bill To</div>
            <div className="font-semibold text-sm" style={{ color: '#1a1a1a' }}>
              {field(invoice.bill_to_name)}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9CA3AF' }}>Property / Service Location</div>
            <div className="font-semibold text-sm" style={{ color: '#1a1a1a' }}>
              {field(invoice.property_name)}
            </div>
          </div>
        </div>

        {/* Line items */}
        {lineItems.length > 0 ? (
          <table className="w-full mb-6" style={{ fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #1a1a1a' }}>
                <th className="text-left pb-2 font-semibold" style={{ color: '#1a1a1a' }}>Description</th>
                <th className="text-center pb-2 w-16 font-semibold" style={{ color: '#1a1a1a' }}>Qty</th>
                <th className="text-right pb-2 w-24 font-semibold" style={{ color: '#1a1a1a' }}>Unit Price</th>
                <th className="text-right pb-2 w-24 font-semibold" style={{ color: '#1a1a1a' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, i) => (
                <tr key={i} style={{
                  borderBottom: '1px solid #F3F4F6',
                  backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                }}>
                  <td className="py-2 pr-4" style={{ color: '#374151' }}>{item.description}</td>
                  <td className="py-2 text-center tabular-nums" style={{ color: '#6B7280' }}>{item.qty}</td>
                  <td className="py-2 text-right tabular-nums" style={{ color: '#6B7280' }}>
                    {item.unit_price > 0 ? `$${Number(item.unit_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td className="py-2 text-right tabular-nums font-medium" style={{ color: '#1a1a1a' }}>
                    {item.total > 0 ? `$${Number(item.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          invoice.description && (
            <div className="mb-6 p-3 rounded" style={{ backgroundColor: '#F3F4F6', fontSize: '13px', color: '#374151' }}>
              {invoice.description}
            </div>
          )
        )}

        {/* Total */}
        <div className="flex justify-end mb-6">
          <div className="w-56">
            <div className="flex justify-between py-2 px-2 rounded mt-1"
              style={{ backgroundColor: '#1a1a1a' }}>
              <span className="text-sm font-bold" style={{ color: 'white' }}>Total Due</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: 'white' }}>
                {money(invoice.amount)}
              </span>
            </div>
          </div>
        </div>

        {glSplits.length > 0 && (
          <div className="mb-6">
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9CA3AF' }}>
              Accounting Allocation
            </div>
            <table className="w-full" style={{ fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #D1D5DB' }}>
                  <th className="text-left pb-2 font-semibold" style={{ color: '#1a1a1a' }}>Entity</th>
                  <th className="text-left pb-2 font-semibold" style={{ color: '#1a1a1a' }}>G/L</th>
                  <th className="text-left pb-2 font-semibold" style={{ color: '#1a1a1a' }}>Description</th>
                  <th className="text-right pb-2 font-semibold" style={{ color: '#1a1a1a' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {glSplits.map((split, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td className="py-2" style={{ color: '#374151' }}>{split.entity_name || split.entity_code || '—'}</td>
                    <td className="py-2" style={{ color: '#374151' }}>{split.gl_code || '—'}</td>
                    <td className="py-2" style={{ color: '#6B7280' }}>{split.description || '—'}</td>
                    <td className="py-2 text-right tabular-nums" style={{ color: '#1a1a1a' }}>
                      {split.amount != null ? `$${Number(split.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Parse status notice */}
        <div className="text-xs pt-4" style={{ borderTop: '1px solid #E5E7EB', color: '#9CA3AF' }}>
          Fields marked <em>Needs review</em> were not detected in the PDF. Edit them in the panel on the right.
        </div>
      </div>
    </div>
  )
}
