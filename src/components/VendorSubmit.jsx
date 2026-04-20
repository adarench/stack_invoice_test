import { useState, useRef, useCallback } from 'react'
import { Upload, X, FileText, CheckCircle, Loader, AlertTriangle, Send } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../lib/supabaseClient'
import { uploadInvoiceFile, createInvoice } from '../api/invoiceApi'
import { parseAndNormalizeInvoice, buildInvoiceDraft } from '../lib/invoiceIngestion'

export default function VendorSubmit({ onSubmitted }) {
  const { isDark } = useTheme()
  const inputRef = useRef(null)

  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState(null)
  const [parseError, setParseError] = useState(null)

  const [fields, setFields] = useState({
    vendorName: '',
    contactEmail: '',
    propertyName: '',
    invoiceNumber: '',
    amount: '',
    documentType: 'invoice',
    notes: '',
  })

  const [status, setStatus] = useState('idle') // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState('')

  const acceptFile = useCallback(async (f) => {
    if (!f) return
    if (f.type !== 'application/pdf') {
      setErrorMsg('Only PDF files are supported.')
      return
    }
    if (f.size > 20 * 1024 * 1024) {
      setErrorMsg('File must be under 20 MB.')
      return
    }
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
      propertyName: current.propertyName || parsedInvoice?.propertyName || '',
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

    // Validate required fields
    const { invoiceData, createInvoiceInput } = buildInvoiceDraft({
      channel: 'vendor',
      source: 'external_submission',
      submittedFields: fields,
      parsed,
      parseError,
    })

    if (!invoiceData.vendor_name) { setErrorMsg('Vendor / company name is required.'); return }
    if (!fields.contactEmail.trim()) { setErrorMsg('Contact email is required.'); return }
    if (!invoiceData.property_name) { setErrorMsg('Property name is required when it cannot be parsed from the PDF.'); return }
    if (!file) { setErrorMsg('Please attach an invoice PDF.'); return }

    setErrorMsg('')
    setStatus('submitting')

    try {
      if (supabase) {
        // Upload file under a "vendor" folder since there's no authenticated user
        const fileUrl = await uploadInvoiceFile(file, 'vendor')
        const invoice = await createInvoice({
          fileUrl,
          uploadedBy: null, // no authenticated user
          ...createInvoiceInput,
        })
        setStatus('success')
        onSubmitted?.(invoice)
      } else {
        // Mock mode
        await new Promise(r => setTimeout(r, 800))
        const mockInvoice = {
          id: `INV-${String(Date.now()).slice(-6)}`,
          status: 'uploaded',
          file_url: null,
          created_at: new Date().toISOString(),
          assigned_to: null,
          assigned_user: null,
          ...invoiceData,
        }
        setStatus('success')
        onSubmitted?.(mockInvoice)
      }
    } catch (err) {
      console.error('[VendorSubmit] error:', err)
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
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="w-full max-w-md text-center p-10 rounded-2xl"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: 'rgba(16,185,129,0.12)' }}>
            <CheckCircle size={32} style={{ color: '#10B981' }} />
          </div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-1)' }}>Invoice Submitted</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-5)' }}>
            Your invoice has been received and will be reviewed by the property management team.
            You'll receive updates at <strong style={{ color: 'var(--text-3)' }}>{fields.contactEmail}</strong>.
          </p>
          <button
            onClick={() => {
              setStatus('idle')
              setFile(null)
              setParsed(null)
              setParseError(null)
              setParsing(false)
              setFields({ vendorName: '', contactEmail: '', propertyName: '', invoiceNumber: '', amount: '', documentType: 'invoice', notes: '' })
            }}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{ backgroundColor: '#1D4ED8', color: 'white' }}
          >
            Submit Another Invoice
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden fade-in"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}>

        {/* Header */}
        <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}>
              <span className="text-xs font-bold text-white">OF</span>
            </div>
            <span className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>OpsFlow</span>
          </div>
          <h2 className="text-lg font-semibold mt-3" style={{ color: 'var(--text-1)' }}>
            Submit an Invoice
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-5)' }}>
            Vendors and subcontractors can submit invoices directly to the property management team.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Vendor info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-5)' }}>
                Vendor / Company Name <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input style={inputStyle} value={fields.vendorName}
                onChange={e => setFields(f => ({ ...f, vendorName: e.target.value }))}
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
              <input style={inputStyle} value={fields.propertyName}
                onChange={e => setFields(f => ({ ...f, propertyName: e.target.value }))}
                placeholder="e.g. Oakwood Terrace" />
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
                onChange={e => setFields(f => ({ ...f, invoiceNumber: e.target.value }))}
                placeholder="e.g. INV-8953" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-5)' }}>
                Amount
              </label>
              <input style={inputStyle} type="text" inputMode="decimal" value={fields.amount}
                onChange={e => setFields(f => ({ ...f, amount: e.target.value.replace(/[^0-9.\-]/g, '') }))}
                placeholder="0.00" />
            </div>
          </div>

          {/* Notes */}
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
              }}
            >
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

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all"
            style={{
              backgroundColor: status === 'submitting' ? 'rgba(29,78,216,0.6)' : '#1D4ED8',
              color: 'white',
              cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
            }}
          >
            {status === 'submitting'
              ? <><Loader size={14} className="spin-slow" /> Submitting…</>
              : <><Send size={14} /> Submit Invoice</>
            }
          </button>
        </form>
      </div>
    </div>
  )
}
