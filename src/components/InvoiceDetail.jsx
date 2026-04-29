import { useState, useEffect, useRef } from 'react'
import {
  ArrowLeft, CheckCircle, AlertTriangle, Clock, ExternalLink, Zap,
  X, Loader, MessageSquare, Send, User, ChevronDown, Edit2, Check, Trash2
} from 'lucide-react'
import StatusBadge from './StatusBadge'
import FakePDF from './FakePDF'
import ParsedInvoiceView from './ParsedInvoiceView'
import ParseStatusBanner from './ParseStatusBanner'
import FmtAmtInput from './FmtAmtInput'
import GlCodePicker from './GlCodePicker'
import PropertySelect from './PropertySelect'
import { findGlAccount, validateGlCode, suggestGlFromText, normalizeGlCode } from '../data/chartOfAccounts'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { fetchComments, addComment } from '../api/commentApi'
import { fetchAuditLogs } from '../api/auditApi'
import { fetchUsers } from '../api/userApi'
import { WORKFLOW_STATUSES, ROLE_LABELS, normalizeRole, normalizeWorkflowStatus } from '../data/demoUsers'
import { allocationBlockReason, calculateSplitTotal, createEmptyGlSplit, hasSplitMismatch, normalizeGlSplits, portfolioState, syncGlSplitsWithProperty } from '../lib/invoiceAccounting'
import { findPropertyCatalogEntry, PORTFOLIO_OPTIONS } from '../data/propertyCatalog'

function displayStatus(status) {
  return WORKFLOW_STATUSES[normalizeWorkflowStatus(status)] || status
}

function formatTs(ts) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  } catch { return ts }
}

function UserAvatar({ name, size = 20 }) {
  const initials = name
    ? name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
    : '?'
  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontSize: size * 0.42 }}
    >
      {initials}
    </div>
  )
}

function actorName(profile, fallback) {
  return profile?.full_name || profile?.email?.split('@')[0] || fallback || '—'
}

function normalizeIdentity(value) {
  return (value || '').trim().toLowerCase()
}

export default function InvoiceDetail({ invoice, onAction, onBack }) {
  const { isDark } = useTheme()
  const { user, isMockMode, role, permissions } = useAuth()

  // ── Modals / action state ──────────────────────────────────────────────────
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showFlagModal, setShowFlagModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(false)
  const [actionNote, setActionNote] = useState('')

  // ── Editable fields ────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false)
  const [editFields, setEditFields] = useState({
    vendor_name: invoice.vendor_name || '',
    property_name: invoice.property_name || '',
    amount: invoice.amount != null ? String(invoice.amount) : '',
    portfolio_override: invoice.portfolio_override || '',
  })
  const [glSplits, setGlSplits] = useState(normalizeGlSplits(invoice.gl_splits, invoice))
  const [saving, setSaving] = useState(false)
  const [mappingProperty, setMappingProperty] = useState(invoice.property_name || '')
  const [mappingSaving, setMappingSaving] = useState(false)

  // ── Assignment ─────────────────────────────────────────────────────────────
  const [users, setUsers] = useState([])
  const [assigning, setAssigning] = useState(false)

  // ── Comments ───────────────────────────────────────────────────────────────
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const commentsEndRef = useRef(null)

  // ── Audit logs (real mode) ─────────────────────────────────────────────────
  const [auditLogs, setAuditLogs] = useState([])

  // ── Load remote data ───────────────────────────────────────────────────────
  useEffect(() => {
    if (isMockMode || !supabase) return

    const isUUID = /^[0-9a-f-]{36}$/.test(invoice.id)
    if (!isUUID) return

    fetchComments(invoice.id).then(setComments).catch(console.error)
    fetchAuditLogs(invoice.id).then(setAuditLogs).catch(console.error)
    fetchUsers().then(setUsers).catch(console.error)
  }, [invoice.id, isMockMode])

  // Scroll to bottom when comments load
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  // Keep edit fields in sync if invoice prop changes
  useEffect(() => {
    setEditFields({
      vendor_name: invoice.vendor_name || '',
      property_name: invoice.property_name || '',
      amount: invoice.amount != null ? String(invoice.amount) : '',
      portfolio_override: invoice.portfolio_override || '',
    })
    setGlSplits(normalizeGlSplits(invoice.gl_splits, invoice))
    setMappingProperty(invoice.property_name || '')
  }, [invoice.vendor_name, invoice.property_name, invoice.amount, invoice.gl_splits, invoice.portfolio_override])

  // 2A — Auto-fill first split row when invoice has an amount but no row has one
  useEffect(() => {
    if (invoice.amount == null) return
    setGlSplits(current => {
      if (current.length === 0) return current
      const anyFilled = current.some(r => r.amount != null && r.amount !== '')
      if (anyFilled) return current
      return current.map((row, idx) => idx === 0 ? { ...row, amount: Number(invoice.amount) } : row)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.id])

  // 2B — When exactly one split row is populated, sync it with invoice amount
  const populatedSplitCount = glSplits.filter(r => r.amount != null && r.amount !== '').length
  const canSyncSplitAmount = populatedSplitCount <= 1

  const handleAmountChange = (nextAmount) => {
    setEditFields(f => ({ ...f, amount: nextAmount == null ? '' : String(nextAmount) }))
    if (canSyncSplitAmount) {
      setGlSplits(rows => {
        const anyFilled = rows.some(r => r.amount != null && r.amount !== '')
        if (!anyFilled && rows.length > 0) {
          return rows.map((r, i) => i === 0 ? { ...r, amount: nextAmount } : r)
        }
        return rows.map(r => (r.amount != null && r.amount !== '') ? { ...r, amount: nextAmount } : r)
      })
    }
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleApprove = () => {
    setApproving(true)
    setTimeout(() => {
      onAction(invoice.id, 'approve', { note: actionNote || 'Approved via OpsFlow' })
      setApproving(false)
      setApproved(true)
      setTimeout(() => { setShowApproveModal(false); setApproved(false); setActionNote('') }, 1200)
    }, 1000)
  }

  const handleReject = () => {
    onAction(invoice.id, 'reject', { note: actionNote || 'Rejected' })
    setShowFlagModal(false)
    setActionNote('')
  }

  const handleSaveEdits = async () => {
    setSaving(true)
    try {
      const amount = editFields.amount ? parseFloat(editFields.amount) : null
      const fields = {
        vendor_name: editFields.vendor_name,
        property_name: editFields.property_name,
        amount,
        gl_splits: syncGlSplitsWithProperty(glSplits, {
          ...invoice,
          property_name: editFields.property_name,
          portfolio_override: editFields.portfolio_override || null,
          amount,
        }),
        portfolio_override: editFields.portfolio_override || null,
      }
      await onAction(invoice.id, 'edit', { fields })
      setMappingProperty(editFields.property_name)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleResolveMapping = async () => {
    const selectedProperty = findPropertyCatalogEntry(mappingProperty)
    if (!selectedProperty) return

    setMappingSaving(true)
    try {
      const nextFields = {
        property_name: selectedProperty.property_name,
        portfolio_override: null,
        gl_splits: syncGlSplitsWithProperty(invoice.gl_splits, {
          ...invoice,
          property_name: selectedProperty.property_name,
          portfolio_override: null,
        }),
      }
      await onAction(invoice.id, 'edit', { fields: nextFields })
      setMappingProperty(selectedProperty.property_name)
    } finally {
      setMappingSaving(false)
    }
  }

  const handleAssign = async (userId) => {
    setAssigning(true)
    const profile = users.find(u => u.id === userId) || null
    await onAction(invoice.id, 'assign', { userId: userId || null, userProfile: profile })
    setAssigning(false)
  }

  const handlePostComment = async (e) => {
    e.preventDefault()
    const content = newComment.trim()
    if (!content || postingComment) return
    setPostingComment(true)

    if (isMockMode || !supabase) {
      // Optimistic mock comment
      const mock = {
        id: Date.now().toString(),
        content,
        created_at: new Date().toISOString(),
        user: { id: user?.id, full_name: user?.user_metadata?.full_name || user?.email?.split('@')[0], email: user?.email },
      }
      setComments(prev => [...prev, mock])
      setNewComment('')
      setPostingComment(false)
      return
    }

    try {
      const comment = await addComment(invoice.id, user.id, content)
      setComments(prev => [...prev, comment])
      setNewComment('')
    } catch (err) {
      console.error(err)
    } finally {
      setPostingComment(false)
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────
  const status = displayStatus(invoice.status)
  const dbStatus = normalizeWorkflowStatus(invoice.status)
  const auditEntries = isMockMode ? (invoice.audit || []) : auditLogs
  const assignedUser = invoice.assigned_user
  const uploaderUser = invoice.uploader
  const reviewerUser = invoice.reviewer
  const approverUser = invoice.approver
  const payerUser = invoice.payer
  const normalizedGlSplits = normalizeGlSplits(invoice.gl_splits, invoice)
  const splitTotal = calculateSplitTotal(glSplits)
  const splitMismatch = hasSplitMismatch(editFields.amount ? parseFloat(editFields.amount) : invoice.amount, glSplits)
  const activePortfolio = portfolioState({
    property_name: editing ? editFields.property_name : invoice.property_name,
    portfolio_override: editing ? editFields.portfolio_override : invoice.portfolio_override,
  })
  const selectedMappingEntry = findPropertyCatalogEntry(mappingProperty)
  const mappingPreview = portfolioState({
    ...invoice,
    property_name: selectedMappingEntry?.property_name || mappingProperty,
    portfolio_override: null,
  })
  const allocationBlock = allocationBlockReason(
    editFields.amount ? parseFloat(editFields.amount) : invoice.amount,
    editing ? glSplits : normalizedGlSplits
  )
  const internalUsers = users.filter(candidate => normalizeRole(candidate.role) !== 'vendor')
  const resolvedAssignedUser = internalUsers.find(candidate => {
    if (candidate.id === invoice.assigned_to || candidate.id === assignedUser?.id) return true
    if (normalizeIdentity(candidate.email) && normalizeIdentity(candidate.email) === normalizeIdentity(assignedUser?.email)) return true
    if (normalizeIdentity(candidate.full_name) && normalizeIdentity(candidate.full_name) === normalizeIdentity(assignedUser?.full_name)) return true
    return false
  }) || null
  const displayedAssignedUser = resolvedAssignedUser || assignedUser
  const currentAssignedId = resolvedAssignedUser?.id || invoice.assigned_to || assignedUser?.id || ''
  const canSelfReview = permissions.canApprove || permissions.canOverride
  const isAssignedToCurrentUser = !!displayedAssignedUser && (
    displayedAssignedUser.id === user?.id ||
    normalizeIdentity(displayedAssignedUser.email) === normalizeIdentity(user?.email)
  )
  const fallbackSelfReviewer = user ? {
    id: user.id,
    full_name: user.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
    email: user.email,
    role,
  } : null
  const submitReviewerId = currentAssignedId || (canSelfReview ? user?.id : null)
  const submitReviewerProfile = internalUsers.find(candidate => candidate.id === submitReviewerId) || fallbackSelfReviewer
  const canSubmitForReview = dbStatus === 'uploaded' && (permissions.canAssign || permissions.canApprove || permissions.canOverride) && !!submitReviewerId
  const canApproveInvoice = permissions.canApprove && dbStatus === 'in_review' && (role === 'admin' || !currentAssignedId || isAssignedToCurrentUser)

  // Who needs to act next?
  let nextAction = null
  if (dbStatus === 'uploaded') nextAction = 'Assign to a reviewer and submit'
  else if (dbStatus === 'in_review') nextAction = 'Reviewer decision needed'
  else if (dbStatus === 'approved') nextAction = 'Approved — ready for payment'
  else if (dbStatus === 'paid') nextAction = 'Completed'

  const inputStyle = {
    backgroundColor: 'var(--surface-alt)',
    border: '1px solid var(--border-strong)',
    color: 'var(--text-2)',
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '12px',
    outline: 'none',
    width: '100%',
  }

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
        <span className="font-mono text-sm" style={{ color: '#3B82F6' }}>
          {invoice.invoice_number || (typeof invoice.id === 'string' ? invoice.id.slice(0, 8) : invoice.id)}
        </span>
        <StatusBadge status={status} />
        {(invoice.source === 'external_submission' || invoice.source === 'vendor') && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium"
            style={{ backgroundColor: 'rgba(139,92,246,0.12)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.3)' }}>
            Vendor Submitted
          </span>
        )}
        {invoice.risk_flag && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium"
            style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
            <AlertTriangle size={10} /> Review Recommended
          </span>
        )}
        {invoice.ai_confidence != null && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text-5)' }}>Extraction confidence:</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded"
              style={{
                backgroundColor: invoice.ai_confidence >= 90 ? 'rgba(16,185,129,0.12)' : invoice.ai_confidence >= 70 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                color: invoice.ai_confidence >= 90 ? (isDark ? '#6EE7B7' : '#065F46') : invoice.ai_confidence >= 70 ? (isDark ? '#FCD34D' : '#92400E') : (isDark ? '#FCA5A5' : '#991B1B'),
              }}>
              {invoice.ai_confidence}%
            </span>
          </div>
        )}
      </div>

      {/* Split layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — PDF (58%) */}
        <div className="flex-shrink-0 overflow-y-auto p-6 themed"
          style={{ width: '55%', borderRight: '1px solid var(--border)', backgroundColor: isDark ? '#080F1C' : '#E8EDF5' }}>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-6)' }}>
              Original Document
            </span>
            {invoice.file_url && (
              <a href={invoice.file_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs" style={{ color: '#3B82F6' }}>
                <ExternalLink size={11} /> Open PDF
              </a>
            )}
          </div>

          {invoice.file_url ? (
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', height: '75vh' }}>
              <iframe
                src={invoice.file_url}
                title="Invoice PDF"
                className="w-full h-full"
                style={{ border: 'none', display: 'block' }}
              />
            </div>
          ) : invoice.source === 'upload' || invoice.parse_status ? (
            // Real uploaded invoice — show parsed data, never the FakePDF template
            <ParsedInvoiceView invoice={invoice} />
          ) : (
            // Demo/mock data from mockData.js — FakePDF is intentional here
            <FakePDF invoice={invoice} />
          )}
        </div>

        {/* Right — panels (42%) */}
        <div className="flex-1 overflow-y-auto themed" style={{ backgroundColor: 'var(--bg)' }}>
          <div className="p-5 space-y-4">

            {/* ── Modified banner ──────────────────────────────────── */}
            {Array.isArray(invoice.edit_log) && invoice.edit_log.length > 0 && (() => {
              const lastEntry = invoice.edit_log[invoice.edit_log.length - 1]
              return (
                <div className="rounded-md px-3 py-2 text-xs flex items-start justify-between gap-3"
                  style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#92400E' }}>
                  <div>
                    <div><strong>✎ Modified</strong> by {lastEntry.user} at {formatTs(lastEntry.timestamp)}</div>
                    {Array.isArray(lastEntry.fields) && lastEntry.fields.length > 0 && (
                      <div className="mt-0.5">Changed: {lastEntry.fields.join(', ')}</div>
                    )}
                    {invoice.edit_log.length > 1 && (
                      <div className="mt-0.5" style={{ opacity: 0.7 }}>
                        {invoice.edit_log.length} edits total
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => onAction(invoice.id, 'mark_reviewed')}
                    className="px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 flex-shrink-0"
                    style={{ backgroundColor: '#059669', color: 'white' }}
                  >
                    <Check size={11} /> Reviewed
                  </button>
                </div>
              )
            })()}

            <ParseStatusBanner invoice={invoice} />

            {/* ── Extracted / Editable Data ─────────────────────────────── */}
            <div className="rounded-lg overflow-hidden themed"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-center gap-2 px-4 py-2.5 themed"
                style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-alt)' }}>
                <Zap size={12} style={{ color: '#60A5FA' }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-4)' }}>
                  Invoice Details
                </span>
                <button
                  onClick={() => editing ? handleSaveEdits() : setEditing(true)}
                  disabled={saving}
                  className="ml-auto flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors"
                  style={{
                    backgroundColor: editing ? 'rgba(16,185,129,0.12)' : 'transparent',
                    color: editing ? '#10B981' : 'var(--text-5)',
                    border: editing ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent',
                  }}
                >
                  {saving ? <Loader size={10} className="spin-slow" /> : editing ? <><Check size={10} /> Save</> : <><Edit2 size={10} /> Edit</>}
                </button>
                {editing && (
                  <button onClick={() => setEditing(false)} className="text-xs" style={{ color: 'var(--text-6)' }}>
                    Cancel
                  </button>
                )}
              </div>
              <div className="p-4">
                {editing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs block mb-1" style={{ color: 'var(--text-5)' }}>Vendor</label>
                      <input style={inputStyle} value={editFields.vendor_name}
                        onChange={e => setEditFields(f => ({ ...f, vendor_name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs block mb-1" style={{ color: 'var(--text-5)' }}>Property</label>
                      <PropertySelect
                        value={editFields.property_name}
                        parsedValue={invoice.property_name || ''}
                        onChange={(property_name) => setEditFields(f => ({ ...f, property_name }))}
                        selectStyle={inputStyle}
                        inputStyle={inputStyle}
                        emptyLabel="Select property"
                      />
                    </div>
                    <div>
                      <label className="text-xs block mb-1" style={{ color: 'var(--text-5)' }}>Amount</label>
                      <FmtAmtInput
                        style={inputStyle}
                        value={editFields.amount === '' ? null : Number(editFields.amount)}
                        onChange={(next) => handleAmountChange(next)}
                      />
                      {!canSyncSplitAmount && (
                        <p className="text-xs mt-1" style={{ color: 'var(--text-6)' }}>
                          Multiple split rows are populated — amount sync is disabled.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs block mb-1" style={{ color: 'var(--text-5)' }}>Portfolio override</label>
                      <select
                        value={editFields.portfolio_override}
                        onChange={e => setEditFields(f => ({ ...f, portfolio_override: e.target.value }))}
                        style={inputStyle}
                      >
                        <option value="">Auto-map from property name</option>
                        {PORTFOLIO_OPTIONS.map(entry => (
                          <option key={entry.value} value={entry.value}>
                            {entry.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <>
                    {[
                      { label: 'Vendor',       value: invoice.vendor_name },
                      ...(invoice.vendor_email ? [{ label: 'Vendor Email', value: invoice.vendor_email, accent: true }] : []),
                      { label: 'Property',     value: invoice.property_name },
                      ...(invoice.building ? [{ label: 'Building', value: invoice.building }] : []),
                      { label: 'Amount',       value: invoice.amount != null ? `$${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—', big: true },
                      ...(invoice.invoice_number ? [{ label: 'Invoice #', value: invoice.invoice_number }] : []),
                      ...(invoice.document_type ? [{ label: 'Doc Type', value: invoice.document_type.charAt(0).toUpperCase() + invoice.document_type.slice(1) }] : []),
                      ...(invoice.invoice_type ? [{ label: 'Type', value: invoice.invoice_type }] : []),
                      ...(invoice.gl_code ? [{ label: 'GL Code', value: invoice.gl_code }] : []),
                      ...(invoice.invoice_date ? [{ label: 'Date', value: invoice.invoice_date }] : []),
                      ...(invoice.due_date ? [{ label: 'Due', value: invoice.due_date }] : []),
                      ...(invoice.linked_work_order ? [{ label: 'Work Order', value: invoice.linked_work_order, accent: true }] : []),
                      { label: 'Portfolio', value: activePortfolio.isMapped ? `${activePortfolio.portfolio_label}${activePortfolio.isManual ? ' (manual)' : ''}` : 'Choose property to finish routing', accent: !activePortfolio.isMapped },
                      ...(invoice.source ? [{ label: 'Source', value: (invoice.source === 'external_submission' || invoice.source === 'vendor') ? 'Vendor Submission' : invoice.source === 'upload' ? 'Internal Upload' : invoice.source }] : []),
                      ...(invoice.notes ? [{ label: 'Notes', value: invoice.notes }] : []),
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
                          {row.value || '—'}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* ── Accounting Allocation ─────────────────────────────── */}
            <div className="rounded-lg overflow-hidden themed"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-center gap-2 px-4 py-2.5 themed"
                style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-alt)' }}>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-4)' }}>
                  Accounting Allocation
                </span>
                <span className="ml-auto text-xs" style={{ color: splitMismatch ? '#F59E0B' : 'var(--text-6)' }}>
                  {glSplits.length > 0 ? `$${splitTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Allocation needed'}
                </span>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-5)' }}>Bucket</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: activePortfolio.isMapped ? 'rgba(37,99,235,0.1)' : 'rgba(245,158,11,0.1)',
                      color: activePortfolio.isMapped ? '#2563EB' : '#92400E',
                      border: `1px solid ${activePortfolio.isMapped ? 'rgba(37,99,235,0.2)' : 'rgba(245,158,11,0.25)'}`,
                    }}>
                    {activePortfolio.isMapped ? `${activePortfolio.portfolio_label}${activePortfolio.isManual ? ' (manual)' : ''}` : 'Needs Mapping'}
                  </span>
                </div>
                {activePortfolio.routingSource && activePortfolio.isMapped && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-5)' }}>Routed by</span>
                    <span className="text-xs" style={{ color: 'var(--text-4)' }}>
                      {activePortfolio.routingSource === 'entity' && activePortfolio.entity_code
                        ? `Entity #${activePortfolio.entity_code}${activePortfolio.entity_name ? ` — ${activePortfolio.entity_name}` : ''}`
                        : activePortfolio.routingSource === 'entity-pattern' && activePortfolio.entity_code
                          ? `Entity #${activePortfolio.entity_code} (pattern)`
                          : activePortfolio.routingSource === 'override'
                            ? 'Manual override'
                            : activePortfolio.routingSource === 'property'
                              ? 'Property name'
                              : '—'}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-5)' }}>Queue owner</span>
                  <span className="text-xs font-medium" style={{ color: activePortfolio.suggestedAssignee ? 'var(--text-2)' : 'var(--text-6)' }}>
                    {activePortfolio.suggestedAssignee
                      ? (activePortfolio.suggestedAssignee.full_name || activePortfolio.suggestedAssignee.email)
                      : 'Not configured'}
                  </span>
                </div>
                {Array.isArray(activePortfolio.members) && activePortfolio.members.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-5)' }}>Team</span>
                    <span className="text-xs" style={{ color: 'var(--text-4)' }}>
                      {activePortfolio.members.map(m => m.full_name || m.email?.split('@')[0]).join(', ')}
                    </span>
                  </div>
                )}
                {!activePortfolio.isMapped && (
                  <div className="rounded-md px-3 py-2 text-xs"
                    style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#92400E' }}>
                    Choose a property to finish routing this invoice.
                  </div>
                )}
                {!activePortfolio.isMapped && !editing && (
                  <div
                    className="rounded-lg p-3 space-y-3"
                    style={{ backgroundColor: 'var(--surface-alt)', border: '1px solid var(--border)' }}
                  >
                    <div>
                      <div className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>
                        Routing Required
                      </div>
                      <div className="text-xs mt-1" style={{ color: 'var(--text-5)' }}>
                        Choose a catalog property to remove the mapping hold and route this invoice to the correct portfolio.
                      </div>
                    </div>
                    <PropertySelect
                      value={mappingProperty}
                      parsedValue={invoice.property_name || ''}
                      onChange={setMappingProperty}
                      selectStyle={inputStyle}
                      inputStyle={inputStyle}
                      emptyLabel="Choose property to finish routing"
                    />
                    {selectedMappingEntry && mappingPreview.isMapped && (
                      <div className="text-xs" style={{ color: 'var(--text-4)' }}>
                        This routes to <strong>{mappingPreview.portfolio_label}</strong>
                        {mappingPreview.entity_code ? ` and seeds entity ${mappingPreview.entity_code}${mappingPreview.entity_name ? ` - ${mappingPreview.entity_name}` : ''}` : ''}.
                      </div>
                    )}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleResolveMapping}
                        disabled={!selectedMappingEntry || mappingSaving}
                        className="text-xs font-semibold px-3 py-1.5 rounded"
                        style={{
                          backgroundColor: selectedMappingEntry ? '#1D4ED8' : 'rgba(29,78,216,0.35)',
                          color: 'white',
                          cursor: !selectedMappingEntry || mappingSaving ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {mappingSaving ? 'Saving…' : 'Save Mapping'}
                      </button>
                    </div>
                  </div>
                )}
                {editing ? (
                  <>
                    {glSplits.length === 0 && (
                      <p className="text-xs" style={{ color: 'var(--text-6)' }}>
                        Add allocation rows to split this invoice across entities or G/L codes.
                      </p>
                    )}
                    {(() => {
                      const extraction = invoice.parse_metadata?.gl_extraction
                      if (!extraction) return null
                      const isResolved = extraction.resolved
                      const tone = isResolved
                        ? { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)', accent: '#059669' }
                        : { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.30)', accent: '#B45309' }
                      const confidencePct = Math.round(((extraction.confidence ?? 0) * 100))
                      const sourceLabel = extraction.source
                        ? extraction.source.replace(/_/g, ' ')
                        : 'invoice'
                      return (
                        <div className="rounded-md px-3 py-2 text-xs flex items-center gap-2"
                          style={{ backgroundColor: tone.bg, border: `1px solid ${tone.border}`, color: 'var(--text-4)' }}>
                          <Zap size={10} style={{ color: tone.accent, flexShrink: 0 }} />
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.06)', color: tone.accent, letterSpacing: 0.5 }}>
                              {isResolved ? 'PARSED' : 'NEEDS MATCH'}
                            </span>
                            {isResolved ? (
                              <span>
                                G/L code <strong>{extraction.normalized}</strong>
                                {extraction.description ? ` — ${extraction.description}` : ''} read from {sourceLabel}.
                              </span>
                            ) : (
                              <span>
                                Parser saw <strong>{extraction.raw}</strong> on the {sourceLabel} but it's not in the chart of accounts. Pick the closest match below.
                              </span>
                            )}
                            {confidencePct > 0 && (
                              <span style={{ fontSize: 10, fontWeight: 600, color: tone.accent }}>
                                {confidencePct}% confidence
                              </span>
                            )}
                          </span>
                        </div>
                      )
                    })()}
                    {(() => {
                      if (glSplits.some(r => r.gl_code)) return null

                      const aiSuggestion = invoice.parse_metadata?.gl_suggestion
                      const aiAccount = aiSuggestion?.code
                        ? findGlAccount(normalizeGlCode(aiSuggestion.code))
                        : null

                      if (aiAccount) {
                        const confidencePct = Math.round(((aiSuggestion.confidence ?? 0) * 100))
                        const confidenceColor = confidencePct >= 80 ? '#059669' : confidencePct >= 60 ? '#D97706' : '#6B7280'
                        return (
                          <div className="rounded-md px-3 py-2 text-xs flex items-center gap-2"
                            style={{ backgroundColor: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)', color: 'var(--text-4)' }}>
                            <Zap size={10} style={{ color: '#6366F1', flexShrink: 0 }} />
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, backgroundColor: 'rgba(99,102,241,0.15)', color: '#4F46E5', letterSpacing: 0.5 }}>AI</span>
                              <span>Suggested: <strong>{aiAccount.code}</strong> {aiAccount.name}</span>
                              <span style={{ fontSize: 10, fontWeight: 600, color: confidenceColor }}>
                                {confidencePct}% confidence
                              </span>
                            </span>
                            <button type="button"
                              title={aiSuggestion.reasoning || ''}
                              onClick={() => setGlSplits(rows => rows.map((r, i) => i === 0 && !r.gl_code ? { ...r, gl_code: aiAccount.code } : r))}
                              className="ml-auto text-xs font-semibold px-2 py-0.5 rounded"
                              style={{ backgroundColor: 'rgba(99,102,241,0.12)', color: '#4F46E5' }}>
                              Apply
                            </button>
                          </div>
                        )
                      }

                      const text = [invoice.vendor_name, invoice.description, invoice.raw_text?.slice(0, 500)].filter(Boolean).join(' ')
                      const suggestions = suggestGlFromText(text)
                      if (suggestions.length === 0) return null
                      return (
                        <div className="rounded-md px-3 py-2 text-xs flex items-center gap-2"
                          style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', color: 'var(--text-4)' }}>
                          <Zap size={10} style={{ color: '#3B82F6', flexShrink: 0 }} />
                          <span>Suggested: <strong>{suggestions[0].code}</strong> {suggestions[0].name}</span>
                          <button type="button"
                            onClick={() => setGlSplits(rows => rows.map((r, i) => i === 0 && !r.gl_code ? { ...r, gl_code: suggestions[0].code } : r))}
                            className="ml-auto text-xs font-semibold px-2 py-0.5 rounded"
                            style={{ backgroundColor: 'rgba(59,130,246,0.12)', color: '#2563EB' }}>
                            Apply
                          </button>
                        </div>
                      )
                    })()}
                    {glSplits.map((split, index) => (
                      <div
                        key={`split-${index}`}
                        className="rounded-lg p-3 space-y-2"
                        style={{ backgroundColor: 'var(--surface-alt)', border: '1px solid var(--border)' }}
                      >
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            style={inputStyle}
                            placeholder="Entity code"
                            value={split.entity_code}
                            onChange={e => setGlSplits(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, entity_code: e.target.value } : row))}
                          />
                          <input
                            style={inputStyle}
                            placeholder="Entity name"
                            value={split.entity_name}
                            onChange={e => setGlSplits(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, entity_name: e.target.value } : row))}
                          />
                          <GlCodePicker
                            style={inputStyle}
                            placeholder="G/L code"
                            value={split.gl_code}
                            onChange={(code) => setGlSplits(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, gl_code: code } : row))}
                          />
                          <FmtAmtInput
                            style={inputStyle}
                            placeholder="Amount"
                            value={split.amount == null || split.amount === '' ? null : Number(split.amount)}
                            onChange={(next) => setGlSplits(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, amount: next } : row))}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            style={inputStyle}
                            placeholder="Description"
                            value={split.description}
                            onChange={e => setGlSplits(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, description: e.target.value } : row))}
                          />
                          <button
                            type="button"
                            onClick={() => setGlSplits(current => current.filter((_, rowIndex) => rowIndex !== index))}
                            className="text-xs font-medium px-2 py-1 rounded"
                            style={{ color: '#DC2626', border: '1px solid rgba(220,38,38,0.2)' }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setGlSplits(current => [...current, createEmptyGlSplit({
                          property_name: editFields.property_name || invoice.property_name,
                          portfolio_override: editFields.portfolio_override || invoice.portfolio_override,
                        })])}
                        className="text-xs font-semibold px-3 py-1.5 rounded"
                        style={{ backgroundColor: 'rgba(37,99,235,0.1)', color: '#2563EB' }}
                      >
                        Add Split Row
                      </button>
                      <span className="text-xs font-medium" style={{ color: splitMismatch ? '#F59E0B' : 'var(--text-5)' }}>
                        Invoice total {invoice.amount != null ? `$${Number(editFields.amount || invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                      </span>
                    </div>
                    {splitMismatch && (
                      <div className="rounded-md px-3 py-2 text-xs"
                        style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#92400E' }}>
                        Allocation total must equal invoice total before approval.
                      </div>
                    )}
                  </>
                ) : normalizedGlSplits.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      {normalizedGlSplits.map((split, index) => (
                        <div
                          key={`read-split-${index}`}
                          className="grid grid-cols-[1.2fr_1.3fr_0.9fr] gap-2 py-2"
                          style={{ borderBottom: index < normalizedGlSplits.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                        >
                          <div>
                            <div className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>
                              {split.entity_name || split.entity_code || 'Unassigned entity'}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--text-6)' }}>
                              {split.entity_code || 'No entity code'}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
                              {split.gl_code || 'No G/L code'}
                              {split.gl_code && (() => {
                                const acct = findGlAccount(split.gl_code)
                                if (acct) return (
                                  <span style={{
                                    fontSize: 8, fontWeight: 700, padding: '1px 3px', borderRadius: 2,
                                    backgroundColor: acct.recoverable ? 'rgba(16,185,129,0.12)' : 'rgba(156,163,175,0.15)',
                                    color: acct.recoverable ? '#059669' : '#6B7280',
                                  }}>
                                    {acct.recoverable ? 'R' : 'NR'}
                                  </span>
                                )
                                const v = validateGlCode(split.gl_code)
                                if (v.message) return <span style={{ fontSize: 9, color: '#F59E0B' }}>⚠</span>
                                return null
                              })()}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--text-6)' }}>
                              {findGlAccount(split.gl_code)?.name || split.description || 'No description'}
                            </div>
                          </div>
                          <div className="text-right text-xs font-semibold tabular-nums" style={{ color: 'var(--text-2)' }}>
                            {split.amount != null ? `$${Number(split.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                    {hasSplitMismatch(invoice.amount, normalizedGlSplits) && (
                      <div className="rounded-md px-3 py-2 text-xs"
                        style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#92400E' }}>
                        Allocation total does not equal the invoice amount.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-md px-3 py-2 text-xs"
                    style={{ backgroundColor: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.14)', color: 'var(--text-4)' }}>
                    No accounting allocation added yet. Use Edit to add an entity and G/L allocation before approval.
                  </div>
                )}
              </div>
            </div>

            {/* ── Assignment ─────────────────────────────────────────────── */}
            <div className="rounded-lg p-4 themed"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
              <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-5)' }}>
                Assignment
              </div>
              {(isMockMode || !supabase || users.length === 0) ? (
                <div className="flex items-center gap-2">
                  {displayedAssignedUser ? (
                    <>
                      <UserAvatar name={displayedAssignedUser?.full_name || displayedAssignedUser?.email} />
                      <span className="text-sm" style={{ color: 'var(--text-3)' }}>
                        {displayedAssignedUser?.full_name || displayedAssignedUser?.email?.split('@')[0]}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm" style={{ color: 'var(--text-6)' }}>
                      <User size={13} className="inline mr-1" />Unassigned
                    </span>
                  )}
                  {isMockMode && (
                    <span className="ml-auto text-xs" style={{ color: 'var(--text-7)' }}>
                      (connect Supabase to assign)
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <select
                      value={currentAssignedId}
                      onChange={e => handleAssign(e.target.value || null)}
                      disabled={assigning}
                      className="w-full text-sm rounded-md px-3 py-1.5 outline-none appearance-none pr-7"
                      style={{
                        backgroundColor: 'var(--surface-alt)',
                        border: '1px solid var(--border-strong)',
                        color: 'var(--text-3)',
                      }}
                    >
                      <option value="">— Unassigned —</option>
                      {internalUsers.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.full_name || u.email?.split('@')[0]}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: 'var(--text-6)' }} />
                  </div>
                  {assigning && <Loader size={13} className="spin-slow" style={{ color: 'var(--text-5)' }} />}
                </div>
              )}
            </div>

            {/* ── Workflow Status ──────────────────────────────────────── */}
            <div className="rounded-lg overflow-hidden themed"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-alt)' }}>
                <Clock size={12} style={{ color: '#60A5FA' }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-4)' }}>
                  Workflow
                </span>
                <StatusBadge status={status} />
              </div>
              <div className="p-4 space-y-3">
                {/* Key people */}
                <div className="space-y-2">
                  {uploaderUser && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--text-5)' }}>Uploaded by</span>
                      <span className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{uploaderUser.full_name || uploaderUser.email}</span>
                    </div>
                  )}
                  {displayedAssignedUser && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--text-5)' }}>Assigned to</span>
                      <span className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{displayedAssignedUser.full_name || displayedAssignedUser.email}</span>
                    </div>
                  )}
                  {invoice.notifications?.lastNotifiedAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--text-5)' }}>Review email</span>
                      <span className="text-xs font-medium text-right" style={{ color: 'var(--text-3)' }}>
                        {`Notified ${invoice.notifications.lastNotifiedName || invoice.notifications.lastNotifiedEmail || 'approver'} at ${formatTs(invoice.notifications.lastNotifiedAt)}`}
                      </span>
                    </div>
                  )}
                  {reviewerUser && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--text-5)' }}>Reviewed by</span>
                      <span className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{actorName(reviewerUser)}</span>
                    </div>
                  )}
                  {(invoice.approved_at || approverUser || invoice.approved_by) && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--text-5)' }}>Approved by</span>
                      <span className="text-xs font-medium text-right" style={{ color: 'var(--text-3)' }}>
                        {actorName(approverUser, invoice.approved_by)}
                        {invoice.approved_at ? ` at ${formatTs(invoice.approved_at)}` : ''}
                      </span>
                    </div>
                  )}
                  {(invoice.paid_at || payerUser || invoice.paid_by) && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--text-5)' }}>Paid</span>
                      <span className="text-xs font-medium text-right" style={{ color: 'var(--text-3)' }}>
                        {payerUser || invoice.paid_by ? `by ${actorName(payerUser, invoice.paid_by)} ` : ''}
                        {invoice.paid_at ? `at ${formatTs(invoice.paid_at)}` : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* Next action indicator */}
                {nextAction && (
                  <div className="flex items-center gap-2 p-2.5 rounded-md"
                    style={{
                      backgroundColor: dbStatus === 'paid' ? 'rgba(139,92,246,0.08)' :
                        dbStatus === 'approved' ? 'rgba(16,185,129,0.08)' :
                        dbStatus === 'in_review' ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.08)',
                      border: `1px solid ${
                        dbStatus === 'paid' ? 'rgba(139,92,246,0.2)' :
                        dbStatus === 'approved' ? 'rgba(16,185,129,0.2)' :
                        dbStatus === 'in_review' ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.2)'
                      }`,
                    }}>
                    <span className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>Next:</span>
                    <span className="text-xs" style={{ color: 'var(--text-4)' }}>{nextAction}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Actions ────────────────────────────────────────────────── */}
            <div className="rounded-lg p-4 themed"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
              <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-5)' }}>
                Actions
              </div>
              <div className="flex flex-col gap-2">
                {/* Uploader / Admin: Submit for review */}
                {(permissions.canAssign || permissions.canApprove || permissions.canOverride) &&
                  dbStatus === 'uploaded' && (
                  <div className="space-y-2">
                    <label className="text-xs block" style={{ color: 'var(--text-5)' }}>Assign reviewer</label>
                    <select
                      value={currentAssignedId}
                      onChange={e => {
                        const profile = internalUsers.find(u => u.id === e.target.value) || null
                        onAction(invoice.id, 'assign', { userId: e.target.value || null, userProfile: profile })
                      }}
                      className="w-full text-sm rounded-md px-3 py-1.5 outline-none"
                      style={{ backgroundColor: 'var(--surface-alt)', border: '1px solid var(--border-strong)', color: 'var(--text-3)' }}>
                      <option value="">{canSelfReview ? '— Assign reviewer or leave blank to review it yourself —' : '— Select approver —'}</option>
                      {internalUsers.filter(u => {
                        const normalizedRole = normalizeRole(u.role)
                        return normalizedRole === 'approver' || normalizedRole === 'admin'
                      }).map(u => (
                        <option key={u.id} value={u.id}>{u.full_name} ({ROLE_LABELS[u.role] || u.role})</option>
                      ))}
                    </select>
                    {!currentAssignedId && canSelfReview && (
                      <p className="text-xs" style={{ color: 'var(--text-6)' }}>
                        No reviewer selected. This will assign the invoice to you so you can continue the workflow yourself.
                      </p>
                    )}
                    <button onClick={() => {
                      console.debug('[InvoiceDetail] submit_for_review:', {
                        invoiceId: invoice.id,
                        reviewerId: submitReviewerId,
                        reviewer: submitReviewerProfile,
                      })
                      onAction(invoice.id, 'submit_for_review', {
                        userId: submitReviewerId,
                        userProfile: submitReviewerProfile,
                        note: actionNote || null,
                      })
                      setActionNote('')
                    }}
                      disabled={!canSubmitForReview}
                      className="w-full py-2 rounded-md text-sm font-semibold flex items-center justify-center gap-2 transition-opacity"
                      style={{
                        backgroundColor: canSubmitForReview ? '#1D4ED8' : 'rgba(29,78,216,0.4)',
                        color: 'white',
                        cursor: canSubmitForReview ? 'pointer' : 'not-allowed',
                      }}>
                      <CheckCircle size={14} /> {currentAssignedId ? 'Submit for Review' : canSelfReview ? 'Assign to Me and Submit' : 'Submit for Review'}
                    </button>
                  </div>
                )}

                {/* Reviewer / Admin: Approve */}
                {canApproveInvoice && (
                  <button onClick={() => setShowApproveModal(true)}
                    disabled={!!allocationBlock}
                    className="w-full py-2 rounded-md text-sm font-semibold flex items-center justify-center gap-2"
                    style={{ backgroundColor: allocationBlock ? 'rgba(5,150,105,0.45)' : '#059669', color: 'white', cursor: allocationBlock ? 'not-allowed' : 'pointer' }}>
                    <CheckCircle size={14} /> Approve
                  </button>
                )}

                {/* Reviewer / Admin: Reject */}
                {(permissions.canReject) &&
                  dbStatus === 'in_review' && (
                  <button onClick={() => setShowFlagModal(true)}
                    className="w-full py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2"
                    style={{ border: '1px solid rgba(239,68,68,0.4)', color: isDark ? '#FCA5A5' : '#991B1B', backgroundColor: 'rgba(239,68,68,0.08)' }}>
                    <AlertTriangle size={13} /> Return to Ops
                  </button>
                )}

                {/* Reviewer: Send back */}
                {(permissions.canApprove || permissions.canOverride) &&
                  dbStatus === 'in_review' && (
                  <button onClick={() => onAction(invoice.id, 'send_back', { note: actionNote || null })}
                    className="w-full py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2"
                    style={{ border: '1px solid var(--border-strong)', color: 'var(--text-4)' }}>
                    <Clock size={13} /> Send Back for Clarification
                  </button>
                )}

                {/* Accounting / Admin: Mark paid */}
                {(permissions.canMarkPaid) && dbStatus === 'approved' && (
                  <button onClick={() => onAction(invoice.id, 'mark_paid', { note: actionNote || null })}
                    disabled={!!allocationBlock}
                    className="w-full py-2 rounded-md text-sm font-semibold flex items-center justify-center gap-2"
                    style={{ backgroundColor: allocationBlock ? 'rgba(124,58,237,0.45)' : '#7C3AED', color: 'white', cursor: allocationBlock ? 'not-allowed' : 'pointer' }}>
                    <CheckCircle size={14} /> Mark as Paid
                  </button>
                )}

                {allocationBlock && (dbStatus === 'in_review' || dbStatus === 'approved') && (
                  <div className="rounded-md px-3 py-2 text-xs"
                    style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#92400E' }}>
                    {allocationBlock}
                  </div>
                )}

                {/* Admin: Reopen */}
                {permissions.canOverride && ['approved', 'paid'].includes(dbStatus) && (
                  <button onClick={() => onAction(invoice.id, 'reopen', { note: actionNote || null })}
                    className="w-full py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2"
                    style={{ border: '1px solid var(--border-strong)', color: 'var(--text-4)' }}>
                    Reopen Invoice
                  </button>
                )}

                {/* Status indicators for completed states */}
                {dbStatus === 'approved' && (
                  <div className="flex items-center gap-2 p-3 rounded-md text-sm"
                    style={{ backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: isDark ? '#6EE7B7' : '#065F46' }}>
                    <CheckCircle size={14} /> Approved
                  </div>
                )}
                {/* Optional note for actions */}
                {!['paid'].includes(dbStatus) && (
                  <textarea value={actionNote} onChange={e => setActionNote(e.target.value)} rows={2}
                    placeholder="Add a note for this action…"
                    className="w-full rounded-md px-3 py-2 text-xs outline-none resize-none mt-1"
                    style={{ backgroundColor: 'var(--surface-alt)', border: '1px solid var(--border-strong)', color: 'var(--text-2)' }} />
                )}

                <div className="pt-2 mt-2" style={{ borderTop: '1px solid var(--border)' }}>
                  <button onClick={() => setShowDeleteConfirm(true)}
                    className="w-full py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                    style={{ border: '1px solid rgba(239,68,68,0.25)', color: isDark ? '#FCA5A5' : '#991B1B', backgroundColor: 'rgba(239,68,68,0.06)' }}>
                    <Trash2 size={13} /> Delete Invoice
                  </button>
                </div>
              </div>
            </div>

            {/* ── Comments ───────────────────────────────────────────────── */}
            <div className="rounded-lg overflow-hidden themed"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
              <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-alt)' }}>
                <MessageSquare size={12} style={{ color: '#60A5FA' }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-4)' }}>
                  Comments
                </span>
                {comments.length > 0 && (
                  <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: isDark ? '#1E3A5F' : 'rgba(37,99,235,0.1)', color: isDark ? '#93C5FD' : '#1D4ED8', fontSize: '10px' }}>
                    {comments.length}
                  </span>
                )}
              </div>

              <div className="p-4">
                {comments.length === 0 ? (
                  <p className="text-xs text-center py-4" style={{ color: 'var(--text-6)' }}>
                    No comments yet — be the first to add one.
                  </p>
                ) : (
                  <div className="space-y-4 mb-4">
                    {comments.map(c => {
                      const author = c.user?.full_name || c.user?.email?.split('@')[0] || 'Unknown'
                      const isOwn = c.user?.id === user?.id
                      return (
                        <div key={c.id} className={`flex gap-2.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
                          <UserAvatar name={author} size={24} />
                          <div className={`flex-1 max-w-xs ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                            <div className="flex items-center gap-2 mb-1" style={{ flexDirection: isOwn ? 'row-reverse' : 'row' }}>
                              <span className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{author}</span>
                              <span className="text-xs" style={{ color: 'var(--text-7)', fontSize: '10px' }}>{formatTs(c.created_at)}</span>
                            </div>
                            <div
                              className="rounded-xl px-3 py-2 text-xs leading-relaxed"
                              style={{
                                backgroundColor: isOwn
                                  ? (isDark ? 'rgba(37,99,235,0.25)' : 'rgba(37,99,235,0.12)')
                                  : 'var(--surface-alt)',
                                color: 'var(--text-2)',
                                border: isOwn
                                  ? (isDark ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(37,99,235,0.2)')
                                  : '1px solid var(--border)',
                                borderRadius: isOwn ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                              }}
                            >
                              {c.content}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={commentsEndRef} />
                  </div>
                )}

                {/* Comment input */}
                <form onSubmit={handlePostComment} className="flex items-center gap-2 mt-2">
                  <UserAvatar name={user?.user_metadata?.full_name || user?.email} size={22} />
                  <div className="flex-1 flex items-center gap-2 rounded-lg px-3 py-1.5"
                    style={{ backgroundColor: 'var(--surface-alt)', border: '1px solid var(--border-strong)' }}>
                    <input
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      placeholder="Add a comment…"
                      className="bg-transparent outline-none flex-1 text-xs"
                      style={{ color: 'var(--text-2)' }}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment(e) } }}
                    />
                    <button
                      type="submit"
                      disabled={!newComment.trim() || postingComment}
                      style={{ color: newComment.trim() ? '#3B82F6' : 'var(--text-7)', flexShrink: 0 }}
                    >
                      {postingComment ? <Loader size={13} className="spin-slow" /> : <Send size={13} />}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* ── Audit Log ──────────────────────────────────────────────── */}
            <div className="rounded-lg overflow-hidden themed"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
              <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-alt)' }}>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-5)' }}>
                  Activity Log
                </span>
              </div>
              <div className="p-4">
                {auditEntries.length === 0 ? (
                  <p className="text-xs text-center py-2" style={{ color: 'var(--text-6)' }}>No activity yet.</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-2 top-2 bottom-2 w-px" style={{ backgroundColor: 'var(--border)' }} />
                    <div className="space-y-4 pl-6">
                      {auditEntries.map((entry, i) => {
                        // Handle both mock (entry.event/user/note) and real (entry.action/user.full_name/note) formats
                        const eventLabel = entry.event || entry.action || '—'
                        const who = entry.user
                          ? (typeof entry.user === 'string' ? entry.user : entry.user.full_name || entry.user.email?.split('@')[0])
                          : '—'
                        const note = entry.note || ''
                        const ts = entry.timestamp || entry.created_at || ''
                        return (
                          <div key={i} className="relative">
                            <div className="absolute -left-4 w-2 h-2 rounded-full border" style={{
                              backgroundColor: i === auditEntries.length - 1 ? '#3B82F6' : 'var(--border)',
                              borderColor: i === auditEntries.length - 1 ? '#3B82F6' : 'var(--border-strong)',
                              top: '3px',
                            }} />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>{eventLabel}</span>
                                <span className="text-xs" style={{ color: 'var(--text-6)' }}>·</span>
                                <span className="text-xs" style={{ color: 'var(--text-5)' }}>{who}</span>
                              </div>
                              {note && <div className="text-xs mt-0.5" style={{ color: 'var(--text-5)' }}>{note}</div>}
                              <div className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-7)', fontSize: '10px' }}>
                                {formatTs(ts) || ts}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Approve Modal ─────────────────────────────────────────────────── */}
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
                    <div>
                      <span style={{ color: 'var(--text-5)' }}>Vendor</span><br />
                      <span className="font-medium" style={{ color: 'var(--text-2)' }}>{invoice.vendor_name}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-5)' }}>Amount</span><br />
                      <span className="font-bold" style={{ color: 'var(--text-1)' }}>
                        {invoice.amount != null ? `$${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-5)' }}>Property</span><br />
                      <span className="font-medium" style={{ color: 'var(--text-2)' }}>{invoice.property_name || '—'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-5)' }}>Status</span><br />
                      <StatusBadge status={displayStatus(invoice.status)} />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-4)' }}>
                    Approval note (optional)
                  </label>
                  <textarea value={actionNote} onChange={e => setActionNote(e.target.value)} rows={2}
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

      {/* ── Return Modal ────────────────────────────────────────────────── */}
      {showFlagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowFlagModal(false) }}>
          <div className="w-full max-w-md rounded-xl overflow-hidden fade-in themed"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid rgba(239,68,68,0.3)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="font-semibold flex items-center gap-2" style={{ color: isDark ? '#FCA5A5' : '#991B1B' }}>
                <AlertTriangle size={15} /> Return Invoice to Ops
              </h3>
              <button onClick={() => setShowFlagModal(false)}><X size={16} style={{ color: 'var(--text-5)' }} /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm" style={{ color: 'var(--text-4)' }}>
                This sends the invoice back to Uploaded so Ops can correct it and resubmit.
              </p>
              <textarea value={actionNote} onChange={e => setActionNote(e.target.value)} rows={3}
                placeholder="Reason for returning this invoice…"
                className="w-full rounded-md px-3 py-2 text-sm outline-none resize-none"
                style={{ backgroundColor: 'var(--surface-alt)', border: '1px solid var(--border-strong)', color: 'var(--text-2)' }} />
              <button onClick={handleReject}
                className="w-full py-2.5 rounded-md font-semibold text-sm flex items-center justify-center gap-2"
                style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: isDark ? '#FCA5A5' : '#991B1B', border: '1px solid rgba(239,68,68,0.4)' }}>
                <AlertTriangle size={14} /> Confirm Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ──────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowDeleteConfirm(false) }}>
          <div className="w-full max-w-sm rounded-xl overflow-hidden fade-in themed"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid rgba(239,68,68,0.3)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="font-semibold flex items-center gap-2" style={{ color: isDark ? '#FCA5A5' : '#991B1B' }}>
                <Trash2 size={15} /> Delete Invoice
              </h3>
              <button onClick={() => setShowDeleteConfirm(false)}><X size={16} style={{ color: 'var(--text-5)' }} /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm" style={{ color: 'var(--text-4)' }}>
                This will permanently delete invoice <strong>{invoice.invoice_number || (typeof invoice.id === 'string' ? invoice.id.slice(0, 8) : invoice.id)}</strong>
                {invoice.vendor_name ? ` from ${invoice.vendor_name}` : ''}.
                {invoice.file_url ? ' The attached PDF will also be removed from storage.' : ''}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-6)' }}>
                This action cannot be undone.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onAction(invoice.id, 'delete')
                    setShowDeleteConfirm(false)
                  }}
                  className="flex-1 py-2.5 rounded-md font-semibold text-sm flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#DC2626', color: 'white' }}>
                  <Trash2 size={14} /> Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 rounded-md font-medium text-sm"
                  style={{ border: '1px solid var(--border-strong)', color: 'var(--text-4)' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
