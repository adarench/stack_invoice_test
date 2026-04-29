import { useState, useRef, useCallback } from 'react'
import { Upload, X, FileText, CheckCircle, Loader, AlertTriangle, Zap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../lib/supabaseClient'
import { uploadInvoiceFile, createInvoice, checkDuplicateInvoice } from '../api/invoiceApi'
import { parseAndNormalizeInvoice, buildInvoiceDraft, finalizeInvoiceDraftAfterUpload } from '../lib/invoiceIngestion'
import { canonicalizePropertyName } from '../data/propertyCatalog'
import PropertySelect from './PropertySelect'

export default function UploadInvoice({ onClose, onUploaded }) {
  const { user, isMockMode } = useAuth()
  const { isDark } = useTheme()
  const inputRef = useRef(null)

  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState(null) // parsed fields from PDF
  const [parseError, setParseError] = useState(null)

  // Form fields — pre-filled from parsed data, user-editable
  const [fields, setFields] = useState({ vendorName: '', propertyName: '', invoiceNumber: '', amount: '' })

  const [status, setStatus] = useState('idle') // idle | uploading | success | error
  const [errorMsg, setErrorMsg] = useState('')
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [duplicateAccepted, setDuplicateAccepted] = useState(false)

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

    // ── Parse PDF text immediately on file selection ──────────────────────
    setParsing(true)
    const { parsed: parsedInvoice, parseError: nextParseError } = await parseAndNormalizeInvoice(f, { channel: 'internal' })
    try {
      setParsed(parsedInvoice)
      setParseError(nextParseError)
      // Pre-fill form fields with parsed values — user can still override
      setFields({
        vendorName:    parsedInvoice?.vendorName    || '',
        propertyName:  canonicalizePropertyName(parsedInvoice?.propertyName) || parsedInvoice?.propertyName || '',
        invoiceNumber: parsedInvoice?.invoiceNumber || '',
        amount:        parsedInvoice?.amount != null ? String(parsedInvoice.amount) : '',
      })
      if (nextParseError) {
        console.error('[UploadInvoice] PDF parse error:', nextParseError)
      }
      // Non-fatal — user can fill in fields manually
      if (!parsedInvoice) {
        setFields({ vendorName: f.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '), propertyName: '', invoiceNumber: '', amount: '' })
      }
    } finally {
      setParsing(false)
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    acceptFile(e.dataTransfer.files[0])
  }, [acceptFile])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) return

    const { invoiceData, createInvoiceInput } = buildInvoiceDraft({
      channel: 'internal',
      source: 'upload',
      submittedFields: fields,
      parsed,
      parseError,
    })

    // Duplicate check (before file upload to save storage)
    if (!duplicateAccepted && !isMockMode) {
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
    setStatus('uploading')

    try {
      console.debug('[UploadInvoice] final invoice data:', invoiceData)

      if (!isMockMode && supabase) {
        const fileUrl = await uploadInvoiceFile(file, user.id)
        const { invoiceData: finalizedInvoiceData, createInvoiceInput, parsed: finalizedParsed, parseError: finalizedParseError } = await finalizeInvoiceDraftAfterUpload({
          channel: 'internal',
          source: 'upload',
          submittedFields: fields,
          parsed,
          parseError,
          file,
          fileUrl,
        })

        setParsed(finalizedParsed)
        setParseError(finalizedParseError)
        console.debug('[UploadInvoice] finalized invoice data:', finalizedInvoiceData)
        const invoice = await createInvoice({
          fileUrl,
          uploadedBy:    user.id,
          uploadedByEmail: user.email,
          uploadedByName: user.full_name || user.user_metadata?.full_name || null,
          ...createInvoiceInput,
        })
        console.debug('[UploadInvoice] saved invoice from DB:', invoice)
        setStatus('success')
        setTimeout(() => { onUploaded?.(invoice); onClose() }, 1200)
      } else {
        // Mock mode — simulate a brief upload delay
        await new Promise(r => setTimeout(r, 800))
        const mockInvoice = {
          id:          `INV-${String(Date.now()).slice(-6)}`,
          status:      'uploaded',
          file_url:    null,
          created_at:  new Date().toISOString(),
          assigned_to: null,
          assigned_user: null,
          risk_flag:   null,
          ai_confidence: null,
          ai_insights:   null,
          budget_used:   null,
          gl_splits:     [],
          // Legacy fields for existing mock-data components
          invoice_type: 'Work Order',
          gl_code:      'TBD',
          audit: [{
            event: 'Uploaded',
            timestamp: new Date().toLocaleString(),
            user: user?.email || 'User',
            note: `PDF uploaded — ${parsed ? 'auto-parsed' : 'manual entry'}`,
          }],
          // Real parsed / user-confirmed data
          ...invoiceData,
        }
        console.debug('[UploadInvoice] mock invoice saved to state:', mockInvoice)
        setStatus('success')
        setTimeout(() => { onUploaded?.(mockInvoice); onClose() }, 1200)
      }
    } catch (err) {
      console.error('[UploadInvoice] upload error:', err)
      setErrorMsg(err.message || 'Upload failed. Please try again.')
      setStatus('error')
    }
  }

  const inputStyle = {
    backgroundColor: 'var(--surface-alt)',
    border: '1px solid var(--border-strong)',
    color: 'var(--text-2)',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '13px',
    outline: 'none',
    width: '100%',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget && status !== 'uploading') onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden fade-in"
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <Upload size={15} style={{ color: '#3B82F6' }} />
            <h3 className="font-semibold" style={{ color: 'var(--text-1)', fontSize: '14px' }}>
              Upload Invoice
            </h3>
          </div>
          {status !== 'uploading' && (
            <button onClick={onClose} style={{ color: 'var(--text-5)' }}><X size={16} /></button>
          )}
        </div>

        {status === 'success' ? (
          <div className="p-10 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgba(16,185,129,0.12)' }}>
              <CheckCircle size={28} style={{ color: '#10B981' }} />
            </div>
            <p className="font-semibold" style={{ color: '#10B981' }}>Invoice uploaded</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-5)' }}>
              {parsed ? 'Fields auto-parsed from PDF.' : 'Manual entry saved.'} Opening detail view…
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Drop zone */}
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className="rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
              style={{
                border: `2px dashed ${dragOver ? '#3B82F6' : file ? 'rgba(16,185,129,0.5)' : 'var(--border-strong)'}`,
                backgroundColor: dragOver ? 'rgba(59,130,246,0.06)' : file ? 'rgba(16,185,129,0.04)' : 'var(--surface-alt)',
                padding: file ? '16px 20px' : '40px 20px',
                minHeight: file ? '72px' : '140px',
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={e => acceptFile(e.target.files[0])}
              />
              {file ? (
                <div className="flex items-center gap-3 w-full">
                  <FileText size={20} style={{ color: '#10B981', flexShrink: 0 }} />
                  <div className="text-left flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: 'var(--text-2)' }}>{file.name}</div>
                    <div className="text-xs flex items-center gap-1.5 mt-0.5" style={{ color: 'var(--text-5)' }}>
                      {(file.size / 1024).toFixed(0)} KB · PDF
                      {parsing && (
                        <span className="flex items-center gap-1" style={{ color: '#3B82F6' }}>
                          <Loader size={10} className="spin-slow" /> Parsing…
                        </span>
                      )}
                      {!parsing && parsed && (
                        <span className="flex items-center gap-1" style={{ color: '#10B981' }}>
                          <Zap size={10} /> Auto-filled from PDF
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      setFile(null)
                      setParsed(null)
                      setParseError(null)
                      setFields({ vendorName: '', propertyName: '', invoiceNumber: '', amount: '' })
                    }}
                    style={{ color: 'var(--text-6)', flexShrink: 0 }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(37,99,235,0.08)' }}>
                    <Upload size={18} style={{ color: '#3B82F6' }} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-3)' }}>
                      Drop PDF here or <span style={{ color: '#3B82F6' }}>browse</span>
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-6)' }}>PDF · max 20 MB · fields auto-extracted</p>
                  </div>
                </>
              )}
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 text-xs p-2.5 rounded-lg"
                style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: isDark ? '#FCA5A5' : '#991B1B', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertTriangle size={12} style={{ flexShrink: 0 }} /> {errorMsg}
              </div>
            )}

            {/* Fields — pre-filled from parsed data, editable */}
            <div>
              {parsed && (
                <p className="text-xs mb-2 flex items-center gap-1" style={{ color: '#10B981' }}>
                  <Zap size={11} /> Fields auto-extracted — review and correct if needed
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-5)' }}>
                    Vendor name
                  </label>
                  <input style={inputStyle} value={fields.vendorName}
                    onChange={e => { setFields(f => ({ ...f, vendorName: e.target.value })); setDuplicateWarning(null); setDuplicateAccepted(false) }}
                    placeholder="e.g. HVAC Solutions LLC" />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-5)' }}>
                    Property
                  </label>
                  <PropertySelect
                    value={fields.propertyName}
                    parsedValue={parsed?.propertyName || ''}
                    onChange={(propertyName) => setFields(f => ({ ...f, propertyName }))}
                    selectStyle={inputStyle}
                    inputStyle={inputStyle}
                    emptyLabel="Select property"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-5)' }}>
                    Invoice #
                  </label>
                  <input style={inputStyle} value={fields.invoiceNumber}
                    onChange={e => { setFields(f => ({ ...f, invoiceNumber: e.target.value })); setDuplicateWarning(null); setDuplicateAccepted(false) }}
                    placeholder="e.g. 8953" />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-5)' }}>
                    Amount
                  </label>
                  <input style={inputStyle} type="text" inputMode="decimal"
                    value={fields.amount}
                    onChange={e => { setFields(f => ({ ...f, amount: e.target.value.replace(/[^0-9.\-]/g, '') })); setDuplicateWarning(null); setDuplicateAccepted(false) }}
                    placeholder="0.00" />
                </div>
              </div>
            </div>

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
              disabled={!file || parsing || status === 'uploading'}
              className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all"
              style={{
                backgroundColor: (!file || parsing) ? 'rgba(29,78,216,0.4)' : '#1D4ED8',
                color: 'white',
                cursor: (!file || parsing) ? 'not-allowed' : 'pointer',
              }}
            >
              {status === 'uploading'
                ? <><Loader size={14} className="spin-slow" /> Uploading…</>
                : parsing
                ? <><Loader size={14} className="spin-slow" /> Parsing PDF…</>
                : <><Upload size={14} /> Upload Invoice</>
              }
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
