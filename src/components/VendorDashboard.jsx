import { useState, useRef, useCallback } from 'react'
import {
  Send, Upload, X, FileText, CheckCircle, Loader, AlertTriangle,
  Clock, Eye, DollarSign, Plus, ChevronDown
} from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { uploadInvoiceFile, createInvoice, checkDuplicateInvoice } from '../api/invoiceApi'
import { parseAndNormalizeInvoice, buildInvoiceDraft, finalizeInvoiceDraftAfterUpload } from '../lib/invoiceIngestion'
import { canonicalizePropertyName } from '../data/propertyCatalog'
import StatusBadge from './StatusBadge'
import { sendNotification, resolveRecipients } from '../api/notificationApi'
import VendorInvoiceDetail from './VendorInvoiceDetail'
import PropertySelect from './PropertySelect'

/** Map internal statuses to simplified vendor-facing labels */
export const VENDOR_STATUS = {
  uploaded: 'Submitted',
  in_review: 'In Review',
  under_review: 'In Review',
  approved: 'Approved',
  paid: 'Paid',
  flagged: 'Submitted',
  rejected: 'Submitted',
  needs_triage: 'In Review',
}

export const STATUS_HELP = {
  'Submitted': 'Received by the property management team',
  'In Review': 'Currently being reviewed internally',
  'Approved': 'Approved for payment',
  'Paid': 'Payment completed',
}

function vendorStatus(dbStatus) {
  return VENDOR_STATUS[dbStatus] || 'Submitted'
}

function VendorStatusBadge({ status }) {
  const label = vendorStatus(status)
  const colors = {
    'Submitted': { bg: 'rgba(59,130,246,0.12)', color: '#3B82F6', border: 'rgba(59,130,246,0.3)' },
    'In Review': { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: 'rgba(245,158,11,0.3)' },
    'Approved': { bg: 'rgba(16,185,129,0.12)', color: '#10B981', border: 'rgba(16,185,129,0.3)' },
    'Paid': { bg: 'rgba(139,92,246,0.12)', color: '#8B5CF6', border: 'rgba(139,92,246,0.3)' },
  }
  const c = colors[label] || colors['Submitted']
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium"
      style={{ backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}` }}
      title={STATUS_HELP[label]}>
      {label}
    </span>
  )
}

export default function VendorDashboard({ invoices, onSubmitted }) {
  const { isDark } = useTheme()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('invoices') // 'invoices' | 'submit'
  const [selectedInvoice, setSelectedInvoice] = useState(null)

  // Filter to only this vendor's invoices
  const myInvoices = invoices.filter(i => i.uploaded_by === user?.id)

  const stats = {
    total: myInvoices.length,
    submitted: myInvoices.filter(i => vendorStatus(i.status) === 'Submitted').length,
    inReview: myInvoices.filter(i => vendorStatus(i.status) === 'In Review').length,
    approved: myInvoices.filter(i => vendorStatus(i.status) === 'Approved').length,
    paid: myInvoices.filter(i => vendorStatus(i.status) === 'Paid').length,
  }

  // Show detail view if an invoice is selected
  if (selectedInvoice) {
    return (
      <VendorInvoiceDetail
        invoice={selectedInvoice}
        onBack={() => setSelectedInvoice(null)}
      />
    )
  }

  return (
    <div className="p-6 fade-in max-w-5xl mx-auto">
      {/* Welcome header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
          Vendor Portal
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-5)' }}>
          Submit invoices and track their status with the property management team.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Submitted', count: stats.submitted, icon: Send, color: '#3B82F6' },
          { label: 'In Review', count: stats.inReview, icon: Eye, color: '#F59E0B' },
          { label: 'Approved', count: stats.approved, icon: CheckCircle, color: '#10B981' },
          { label: 'Paid', count: stats.paid, icon: DollarSign, color: '#8B5CF6' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="rounded-lg p-3"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-center gap-2 mb-1">
                <Icon size={13} style={{ color: s.color }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-5)' }}>{s.label}</span>
              </div>
              <div className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>{s.count}</div>
            </div>
          )
        })}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-4">
        <button
          onClick={() => setActiveTab('invoices')}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
          style={{
            backgroundColor: activeTab === 'invoices' ? 'rgba(59,130,246,0.15)' : 'transparent',
            color: activeTab === 'invoices' ? '#3B82F6' : 'var(--text-5)',
            border: activeTab === 'invoices' ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
          }}>
          <FileText size={14} />
          My Invoices {myInvoices.length > 0 && `(${myInvoices.length})`}
        </button>
        <button
          onClick={() => setActiveTab('submit')}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
          style={{
            backgroundColor: activeTab === 'submit' ? 'rgba(59,130,246,0.15)' : 'transparent',
            color: activeTab === 'submit' ? '#3B82F6' : 'var(--text-5)',
            border: activeTab === 'submit' ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
          }}>
          <Plus size={14} />
          Submit Invoice
        </button>
      </div>

      {/* Content */}
      {activeTab === 'invoices' && (
        <VendorInvoiceList invoices={myInvoices} onSubmitClick={() => setActiveTab('submit')} onSelectInvoice={setSelectedInvoice} />
      )}
      {activeTab === 'submit' && (
        <VendorSubmitForm
          user={user}
          onSubmitted={(inv) => {
            onSubmitted?.(inv)
            setActiveTab('invoices')
          }}
        />
      )}

      {/* Status legend */}
      <div className="mt-8 rounded-lg p-4"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-6)' }}>
          Status Guide
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(STATUS_HELP).map(([label, desc]) => (
            <div key={label} className="flex items-start gap-2">
              <span className="text-xs font-semibold mt-0.5" style={{
                color: label === 'Submitted' ? '#3B82F6' : label === 'In Review' ? '#F59E0B'
                  : label === 'Approved' ? '#10B981' : '#8B5CF6',
              }}>{label}</span>
              <span className="text-xs" style={{ color: 'var(--text-5)' }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Vendor invoice list ──────────────────────────────────────────────────────

function VendorInvoiceList({ invoices, onSubmitClick, onSelectInvoice }) {
  if (invoices.length === 0) {
    return (
      <div className="rounded-lg p-12 text-center"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: 'rgba(59,130,246,0.1)' }}>
          <FileText size={24} style={{ color: '#3B82F6' }} />
        </div>
        <p className="font-medium mb-1" style={{ color: 'var(--text-3)' }}>No invoices yet</p>
        <p className="text-sm mb-4" style={{ color: 'var(--text-5)' }}>
          Submit your first invoice to get started.
        </p>
        <button onClick={onSubmitClick}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ backgroundColor: '#1D4ED8', color: 'white' }}>
          <Plus size={14} /> Submit Invoice
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-lg overflow-hidden"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-alt)' }}>
            {['Invoice #', 'Property', 'Amount', 'Type', 'Submitted', 'Status'].map(h => (
              <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-6)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv, i) => {
            const dateStr = inv.created_at
              ? new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : '—'
            const docType = inv.document_type
              ? inv.document_type.charAt(0).toUpperCase() + inv.document_type.slice(1)
              : '—'
            return (
              <tr key={inv.id}
                onClick={() => onSelectInvoice?.(inv)}
                className="cursor-pointer row-hover"
                style={{ borderBottom: i < invoices.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs font-medium" style={{ color: '#3B82F6' }}>
                    {inv.invoice_number || (typeof inv.id === 'string' && inv.id.length > 10 ? inv.id.slice(0, 8) + '…' : inv.id)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm" style={{ color: 'var(--text-3)' }}>{inv.property_name || '—'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-sm tabular-nums" style={{ color: 'var(--text-1)' }}>
                    {inv.amount != null
                      ? `$${Number(inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      : '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs" style={{ color: 'var(--text-5)' }}>{docType}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs" style={{ color: 'var(--text-5)' }}>{dateStr}</span>
                </td>
                <td className="px-4 py-3">
                  <VendorStatusBadge status={inv.status} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Vendor submit form (inline) ──────────────────────────────────────────────

function VendorSubmitForm({ user, onSubmitted }) {
  const { isDark } = useTheme()
  const inputRef = useRef(null)

  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState(null)
  const [parseError, setParseError] = useState(null)
  const [fields, setFields] = useState({
    vendorName: user?.full_name || '',
    contactEmail: user?.email || '',
    propertyName: '',
    invoiceNumber: '',
    amount: '',
    documentType: 'invoice',
    notes: '',
  })
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [duplicateAccepted, setDuplicateAccepted] = useState(false)

  const acceptFile = useCallback(async (f) => {
    if (!f) return
    if (f.type !== 'application/pdf') { setErrorMsg('Only PDF files are supported.'); return }
    if (f.size > 20 * 1024 * 1024) { setErrorMsg('File must be under 20 MB.'); return }
    setErrorMsg('')
    setFile(f)
    setParsed(null)
    setParseError(null)
    setParsing(true)

    const { parsed: parsedInvoice, parseError: nextParseError } = await parseAndNormalizeInvoice(f, { channel: 'vendor' })
    setParsed(parsedInvoice)
    setParseError(nextParseError)
    setFields(current => ({
      ...current,
      vendorName: current.vendorName || parsedInvoice?.vendorName || '',
      propertyName: current.propertyName || canonicalizePropertyName(parsedInvoice?.propertyName) || parsedInvoice?.propertyName || '',
      invoiceNumber: current.invoiceNumber || parsedInvoice?.invoiceNumber || '',
      amount: current.amount || (parsedInvoice?.amount != null ? String(parsedInvoice.amount) : ''),
    }))
    setParsing(false)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    acceptFile(e.dataTransfer.files[0])
  }, [acceptFile])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const { invoiceData, createInvoiceInput } = buildInvoiceDraft({
      channel: 'vendor',
      source: 'vendor',
      submittedFields: fields,
      parsed,
      parseError,
    })

    if (!fields.contactEmail.trim()) { setErrorMsg('Contact email is required.'); return }
    if (!file) { setErrorMsg('Please attach an invoice PDF.'); return }

    // Duplicate check before file upload
    if (!duplicateAccepted && supabase) {
      const result = await checkDuplicateInvoice({
        vendorName: invoiceData.vendor_name,
        invoiceNumber: invoiceData.invoice_number,
        amount: invoiceData.amount,
      })
      if (result.isDuplicate) {
        setDuplicateWarning(result)
        return
      }
    }

    setDuplicateWarning(null)
    setErrorMsg('')
    setStatus('submitting')

    try {
      if (supabase) {
        const fileUrl = await uploadInvoiceFile(file, user?.id || 'vendor')
        const { invoiceData: finalizedInvoiceData, createInvoiceInput, parsed: finalizedParsed, parseError: finalizedParseError } = await finalizeInvoiceDraftAfterUpload({
          channel: 'vendor',
          source: 'vendor',
          submittedFields: fields,
          parsed,
          parseError,
          file,
          fileUrl,
        })

        setParsed(finalizedParsed)
        setParseError(finalizedParseError)
        console.debug('[VendorSubmitForm] finalized invoice data:', finalizedInvoiceData)
        const invoice = await createInvoice({
          fileUrl,
          uploadedBy: user?.id || null,
          uploadedByEmail: user?.email || null,
          uploadedByName: user?.full_name || user?.user_metadata?.full_name || null,
          ...createInvoiceInput,
        })
        // Notify ops team of new vendor submission
        sendNotification({
          action: 'vendor_submission',
          invoice: {
            id: invoice.id,
            invoice_number: invoice.invoice_number,
            vendor_name: invoice.vendor_name,
            property_name: invoice.property_name,
            amount: invoice.amount,
            vendor_email: invoice.vendor_email,
          },
          recipients: await resolveRecipients('vendor_submission', invoice, user),
          actor: { name: user?.full_name || fields.vendorName, email: fields.contactEmail },
        })
        setStatus('success')
        setTimeout(() => onSubmitted?.(invoice), 1200)
      } else {
        await new Promise(r => setTimeout(r, 800))
        const mockInvoice = {
          id: `INV-${String(Date.now()).slice(-6)}`,
          status: 'uploaded',
          file_url: null,
          created_at: new Date().toISOString(),
          uploaded_by: user?.id || null,
          assigned_to: null,
          assigned_user: null,
          ...invoiceData,
        }
        setStatus('success')
        setTimeout(() => onSubmitted?.(mockInvoice), 1200)
      }
    } catch (err) {
      console.error('[VendorSubmitForm] error:', err)
      setErrorMsg(err.message || 'Submission failed. Please try again.')
      setStatus('error')
    }
  }

  const inputStyle = {
    backgroundColor: 'var(--surface-alt)',
    border: '1px solid var(--border-strong)',
    color: 'var(--text-2)',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '13px',
    outline: 'none',
    width: '100%',
  }

  const selectStyle = {
    ...inputStyle,
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 9l6 6 6-6' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
    paddingRight: '30px',
  }

  if (status === 'success') {
    return (
      <div className="rounded-2xl p-10 text-center"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: 'rgba(16,185,129,0.12)' }}>
          <CheckCircle size={28} style={{ color: '#10B981' }} />
        </div>
        <p className="font-semibold" style={{ color: '#10B981' }}>Invoice Submitted</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-5)' }}>
          Your invoice has been received and will appear in your list shortly.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
      <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-alt)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>New Invoice Submission</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-5)' }}>
          Fill in the details and attach the invoice PDF.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-5)' }}>
              Vendor / Company Name <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input style={inputStyle} value={fields.vendorName}
              onChange={e => { setFields(f => ({ ...f, vendorName: e.target.value })); setDuplicateWarning(null); setDuplicateAccepted(false) }}
              placeholder="e.g. HVAC Solutions LLC" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-5)' }}>
              Contact Email <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input style={inputStyle} type="email" value={fields.contactEmail}
              onChange={e => setFields(f => ({ ...f, contactEmail: e.target.value }))}
              placeholder="billing@vendor.com" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-5)' }}>
              Property Name <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <PropertySelect
              value={fields.propertyName}
              parsedValue={parsed?.propertyName || ''}
              onChange={(propertyName) => setFields(f => ({ ...f, propertyName }))}
              selectStyle={selectStyle}
              inputStyle={inputStyle}
              emptyLabel="Select property"
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-5)' }}>
              Document Type
            </label>
            <select style={selectStyle} value={fields.documentType}
              onChange={e => setFields(f => ({ ...f, documentType: e.target.value }))}>
              <option value="invoice">Invoice</option>
              <option value="utility">Utility Bill</option>
              <option value="contract">Contract</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-5)' }}>
              Invoice #
            </label>
            <input style={inputStyle} value={fields.invoiceNumber}
              onChange={e => { setFields(f => ({ ...f, invoiceNumber: e.target.value })); setDuplicateWarning(null); setDuplicateAccepted(false) }}
              placeholder="e.g. INV-8953" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-5)' }}>
              Amount
            </label>
            <input style={inputStyle} type="text" inputMode="decimal" value={fields.amount}
              onChange={e => { setFields(f => ({ ...f, amount: e.target.value.replace(/[^0-9.\-]/g, '') })); setDuplicateWarning(null); setDuplicateAccepted(false) }}
              placeholder="0.00" />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-5)' }}>
            Notes (optional)
          </label>
          <textarea style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
            value={fields.notes}
            onChange={e => setFields(f => ({ ...f, notes: e.target.value }))}
            placeholder="Any additional context for this invoice…" />
        </div>

        {/* Drop zone */}
        <div>
          <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-5)' }}>
            Invoice PDF <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className="rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all"
            style={{
              border: `2px dashed ${dragOver ? '#3B82F6' : file ? 'rgba(16,185,129,0.5)' : 'var(--border-strong)'}`,
              backgroundColor: dragOver ? 'rgba(59,130,246,0.06)' : file ? 'rgba(16,185,129,0.04)' : 'var(--surface-alt)',
              padding: file ? '12px 16px' : '28px 16px',
            }}>
            <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
              onChange={e => acceptFile(e.target.files[0])} />
            {file ? (
                <div className="flex items-center gap-3 w-full">
                  <FileText size={18} style={{ color: '#10B981', flexShrink: 0 }} />
                  <div className="text-left flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: 'var(--text-2)' }}>{file.name}</div>
                    <div className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-5)' }}>
                      {(file.size / 1024).toFixed(0)} KB
                      {parsing && (
                        <span className="flex items-center gap-1" style={{ color: '#3B82F6' }}>
                          <Loader size={10} className="spin-slow" /> Parsing…
                        </span>
                      )}
                      {!parsing && parsed && (
                        <span className="flex items-center gap-1" style={{ color: '#10B981' }}>
                          <Send size={10} /> Parsed from PDF
                        </span>
                      )}
                    </div>
                  </div>
                <button type="button" onClick={e => { e.stopPropagation(); setFile(null); setParsed(null); setParseError(null); setParsing(false) }}
                  style={{ color: 'var(--text-6)', flexShrink: 0 }}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(37,99,235,0.08)' }}>
                  <Upload size={16} style={{ color: '#3B82F6' }} />
                </div>
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                  Drop PDF here or <span style={{ color: '#3B82F6' }}>browse</span>
                </p>
                <p className="text-xs" style={{ color: 'var(--text-6)' }}>PDF only, max 20 MB</p>
              </>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 text-xs p-2.5 rounded-lg"
            style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: isDark ? '#FCA5A5' : '#991B1B', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertTriangle size={12} style={{ flexShrink: 0 }} /> {errorMsg}
          </div>
        )}

        {duplicateWarning && (
          <div className="rounded-lg p-3 space-y-2"
            style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={13} style={{ color: '#F59E0B', flexShrink: 0 }} />
              <span className="text-xs font-semibold" style={{ color: isDark ? '#FCD34D' : '#92400E' }}>
                Possible duplicate {duplicateWarning.matchType === 'exact' ? '(same vendor + invoice #)' : '(same vendor + amount)'}
              </span>
            </div>
            {duplicateWarning.matches.map(m => (
              <div key={m.id} className="text-xs px-2 py-1.5 rounded"
                style={{ backgroundColor: 'var(--surface-alt)', border: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-3)' }}>{m.vendor_name}</span>
                {m.invoice_number && <span style={{ color: 'var(--text-5)' }}> · #{m.invoice_number}</span>}
                {m.amount != null && <span style={{ color: 'var(--text-5)' }}> · ${Number(m.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>}
                <span style={{ color: 'var(--text-6)' }}> · {m.status}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <button type="button"
                onClick={() => { setDuplicateAccepted(true); setDuplicateWarning(null) }}
                className="text-xs font-semibold px-3 py-1 rounded"
                style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: isDark ? '#FCD34D' : '#92400E', border: '1px solid rgba(245,158,11,0.3)' }}>
                Submit Anyway
              </button>
              <button type="button"
                onClick={() => setDuplicateWarning(null)}
                className="text-xs px-3 py-1 rounded"
                style={{ color: 'var(--text-5)' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'submitting'}
          className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all"
          style={{
            backgroundColor: status === 'submitting' ? 'rgba(29,78,216,0.6)' : '#1D4ED8',
            color: 'white',
            cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
          }}>
          {status === 'submitting'
            ? <><Loader size={14} className="spin-slow" /> Submitting…</>
            : <><Send size={14} /> Submit Invoice</>
          }
        </button>
      </form>
    </div>
  )
}
