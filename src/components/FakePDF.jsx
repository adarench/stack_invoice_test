export default function FakePDF({ invoice }) {
  const subtotal = invoice.line_items?.reduce((s, l) => s + l.total, 0) || invoice.amount
  const total = invoice.amount

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        backgroundColor: '#FAFAF8',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        color: '#1a1a1a',
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        minHeight: '700px',
      }}
    >
      {/* PDF toolbar chrome */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ backgroundColor: '#3C4043', borderBottom: '1px solid #2a2a2a' }}
      >
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#FF5F56' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#FFBD2E' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#27C93F' }} />
        </div>
        <div
          className="flex-1 mx-3 px-3 py-0.5 rounded text-xs text-center"
          style={{ backgroundColor: '#2a2a2a', color: '#9CA3AF', fontFamily: 'monospace' }}
        >
          {invoice.invoice_number}.pdf
        </div>
        <div className="flex gap-2">
          {['−', '+', '⤢'].map(s => (
            <button
              key={s}
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: '#4B5563', color: '#9CA3AF' }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Document content */}
      <div className="p-8" style={{ backgroundColor: '#FAFAF8' }}>
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <div
              className="text-xl font-bold mb-1"
              style={{ color: '#1a1a1a', letterSpacing: '-0.03em' }}
            >
              {invoice.vendor_name}
            </div>
            <div className="text-xs space-y-0.5" style={{ color: '#6B7280' }}>
              {invoice.vendor_id === 'v1' && (
                <>
                  <div>2840 Industrial Blvd, Suite 100</div>
                  <div>Austin, TX 78758</div>
                  <div>Tel: (512) 448-2200</div>
                  <div>ap@hvacsolutions.com</div>
                </>
              )}
              {invoice.vendor_id === 'v2' && (
                <>
                  <div>1100 Green Valley Road</div>
                  <div>Austin, TX 78745</div>
                  <div>Tel: (512) 291-8800</div>
                  <div>billing@greenscape.com</div>
                </>
              )}
              {invoice.vendor_id === 'v3' && (
                <>
                  <div>700 Commerce Park Dr</div>
                  <div>Round Rock, TX 78664</div>
                  <div>Tel: (512) 555-0193</div>
                  <div>ap@clearpath.com</div>
                </>
              )}
              {invoice.vendor_id === 'v4' && (
                <>
                  <div>721 Barton Springs Rd</div>
                  <div>Austin, TX 78704</div>
                  <div>commercial@austinenergy.com</div>
                </>
              )}
              {invoice.vendor_id === 'v5' && (
                <>
                  <div>4450 S Congress Ave</div>
                  <div>Austin, TX 78745</div>
                  <div>Tel: (512) 555-0147</div>
                  <div>invoices@quickfixplumbing.com</div>
                </>
              )}
            </div>
          </div>

          <div className="text-right">
            <div
              className="text-2xl font-bold mb-1"
              style={{ color: '#1a1a1a', letterSpacing: '-0.03em' }}
            >
              INVOICE
            </div>
            <table className="text-xs ml-auto">
              <tbody>
                <tr>
                  <td className="pr-4 font-medium text-right" style={{ color: '#6B7280' }}>Invoice #</td>
                  <td className="font-semibold" style={{ color: '#1a1a1a' }}>{invoice.invoice_number}</td>
                </tr>
                <tr>
                  <td className="pr-4 font-medium text-right" style={{ color: '#6B7280' }}>Date</td>
                  <td style={{ color: '#1a1a1a' }}>{invoice.invoice_date}</td>
                </tr>
                <tr>
                  <td className="pr-4 font-medium text-right" style={{ color: '#6B7280' }}>Due Date</td>
                  <td className="font-semibold" style={{ color: '#DC2626' }}>{invoice.due_date}</td>
                </tr>
                {invoice.linked_work_order && (
                  <tr>
                    <td className="pr-4 font-medium text-right" style={{ color: '#6B7280' }}>Work Order</td>
                    <td className="font-medium" style={{ color: '#2563EB' }}>{invoice.linked_work_order}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bill To */}
        <div className="grid grid-cols-2 gap-8 mb-7 pb-7" style={{ borderBottom: '1px solid #E5E7EB' }}>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9CA3AF' }}>Bill To</div>
            <div className="font-semibold text-sm" style={{ color: '#1a1a1a' }}>Premier Properties LLC</div>
            <div className="text-xs mt-1 space-y-0.5" style={{ color: '#6B7280' }}>
              <div>Accounts Payable Department</div>
              <div>3811 Bee Caves Rd, Suite 204</div>
              <div>Austin, TX 78746</div>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9CA3AF' }}>Service Location</div>
            <div className="font-semibold text-sm" style={{ color: '#1a1a1a' }}>{invoice.property_name}</div>
            <div className="text-xs mt-1 space-y-0.5" style={{ color: '#6B7280' }}>
              <div>{invoice.building}</div>
              {invoice.property_id === 'p1' && <div>4200 Oakwood Dr, Austin TX 78759</div>}
              {invoice.property_id === 'p2' && <div>800 Riverside Pkwy, Austin TX 78704</div>}
              {invoice.property_id === 'p3' && <div>1550 Maple Ave, Austin TX 78722</div>}
              {invoice.property_id === 'p4' && <div>201 Congress Ave, Austin TX 78701</div>}
            </div>
          </div>
        </div>

        {/* Line items */}
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
            {invoice.line_items?.map((item, i) => (
              <tr
                key={i}
                style={{
                  borderBottom: '1px solid #F3F4F6',
                  backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                }}
              >
                <td className="py-2 pr-4" style={{ color: '#374151' }}>{item.description}</td>
                <td className="py-2 text-center tabular-nums" style={{ color: '#6B7280' }}>{item.qty}</td>
                <td className="py-2 text-right tabular-nums" style={{ color: '#6B7280' }}>
                  {item.unit_price > 0 ? `$${item.unit_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                </td>
                <td className="py-2 text-right tabular-nums font-medium" style={{ color: '#1a1a1a' }}>
                  {item.total > 0 ? `$${item.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'Incl.'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-56">
            <div className="flex justify-between py-1.5 text-xs" style={{ borderTop: '1px solid #E5E7EB' }}>
              <span style={{ color: '#6B7280' }}>Subtotal</span>
              <span className="tabular-nums font-medium" style={{ color: '#1a1a1a' }}>
                ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between py-1.5 text-xs">
              <span style={{ color: '#6B7280' }}>Tax (0%)</span>
              <span className="tabular-nums" style={{ color: '#9CA3AF' }}>$0.00</span>
            </div>
            <div
              className="flex justify-between py-2 mt-1 px-2 rounded"
              style={{ backgroundColor: '#1a1a1a' }}
            >
              <span className="text-sm font-bold" style={{ color: 'white' }}>Total Due</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: 'white' }}>
                ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Payment terms */}
        <div className="text-xs pt-6" style={{ borderTop: '1px solid #E5E7EB', color: '#9CA3AF' }}>
          <div className="font-semibold mb-1" style={{ color: '#6B7280' }}>Payment Terms & Remittance</div>
          <div>
            Payment due within {invoice.vendor_id === 'v2' ? '15' : invoice.vendor_id === 'v4' ? '21' : '30'} days of invoice date.
            Please remit payment to the address above or via ACH to account on file.
            Reference invoice number <strong style={{ color: '#374151' }}>{invoice.invoice_number}</strong> with all payments.
          </div>
          <div className="mt-2 text-xs" style={{ color: '#D1D5DB' }}>
            Thank you for your business. Questions? Contact us at the email above.
          </div>
        </div>
      </div>
    </div>
  )
}
