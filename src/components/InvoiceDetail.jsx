import { useState, useEffect, useRef } from 'react'
import {
  ArrowLeft, CheckCircle, AlertTriangle, Clock, ExternalLink, Zap,
  X, Loader, MessageSquare, Send, User, ChevronDown, Edit2, Check
} from 'lucide-react'
import StatusBadge from './StatusBadge'
import FakePDF from './FakePDF'
import ParsedInvoiceView from './ParsedInvoiceView'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { fetchComments, addComment } from '../api/commentApi'
import { fetchAuditLogs } from '../api/auditApi'
import { fetchUsers } from '../api/userApi'
import { WORKFLOW_STATUSES, ROLE_LABELS, normalizeWorkflowStatus } from '../data/demoUsers'

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

export default function InvoiceDetail({ invoice, onAction, onBack }) {
  const { isDark } = useTheme()
  const { user, isMockMode, role, permissions } = useAuth()

  // ── Modals / action state ──────────────────────────────────────────────────
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showFlagModal, setShowFlagModal] = useState(false)
  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(false)
  const [actionNote, setActionNote] = useState('')

  // ── Editable fields ────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false)
  const [editFields, setEditFields] = useState({
    vendor_name: invoice.vendor_name || '',
    property_name: invoice.property_name || '',
    amount: invoice.amount != null ? String(invoice.amount) : '',
  })
  const [saving, setSaving] = useState(false)

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
    })
  }, [invoice.vendor_name, invoice.property_name, invoice.amount])

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
    const fields = {
      vendor_name: editFields.vendor_name,
      property_name: editFields.property_name,
      amount: editFields.amount ? parseFloat(editFields.amount) : null,
    }
    await onAction(invoice.id, 'edit', { fields })
    setSaving(false)
    setEditing(false)
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
  const currentAssignedId = invoice.assigned_to || assignedUser?.id || ''

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
            <AlertTriangle size={10} /> Risk Flag Active
          </span>
        )}
        {invoice.ai_confidence != null && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text-5)' }}>AI Confidence:</span>
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
          style={{ width: '58%', borderRight: '1px solid var(--border)', backgroundColor: isDark ? '#080F1C' : '#E8EDF5' }}>
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
                      <input style={inputStyle} value={editFields.property_name}
                        onChange={e => setEditFields(f => ({ ...f, property_name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs block mb-1" style={{ color: 'var(--text-5)' }}>Amount ($)</label>
                      <input style={inputStyle} type="number" step="0.01" value={editFields.amount}
                        onChange={e => setEditFields(f => ({ ...f, amount: e.target.value }))} />
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

            {/* ── Assignment ─────────────────────────────────────────────── */}
            <div className="rounded-lg p-4 themed"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
              <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-5)' }}>
                Assignment
              </div>
              {(isMockMode || !supabase || users.length === 0) ? (
                <div className="flex items-center gap-2">
                  {assignedUser ? (
                    <>
                      <UserAvatar name={assignedUser.full_name || assignedUser.email} />
                      <span className="text-sm" style={{ color: 'var(--text-3)' }}>
                        {assignedUser.full_name || assignedUser.email?.split('@')[0]}
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
                      {users.map(u => (
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
                  {assignedUser && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--text-5)' }}>Assigned to</span>
                      <span className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{assignedUser.full_name || assignedUser.email}</span>
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
                {(permissions.canAssign || permissions.canOverride) &&
                  dbStatus === 'uploaded' && (
                  <div className="space-y-2">
                    <label className="text-xs block" style={{ color: 'var(--text-5)' }}>Assign reviewer</label>
                    <select
                      value={currentAssignedId}
                      onChange={e => {
                        const profile = users.find(u => u.id === e.target.value) || null
                        onAction(invoice.id, 'assign', { userId: e.target.value || null, userProfile: profile })
                      }}
                      className="w-full text-sm rounded-md px-3 py-1.5 outline-none"
                      style={{ backgroundColor: 'var(--surface-alt)', border: '1px solid var(--border-strong)', color: 'var(--text-3)' }}>
                      <option value="">— Select reviewer —</option>
                      {users.filter(u => u.role === 'reviewer' || u.role === 'admin').map(u => (
                        <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                      ))}
                    </select>
                    <button onClick={() => {
                      const reviewer = users.find(u => u.id === currentAssignedId) || null
                      console.debug('[InvoiceDetail] submit_for_review:', { invoiceId: invoice.id, reviewerId: currentAssignedId, reviewer })
                      onAction(invoice.id, 'submit_for_review', {
                        userId: currentAssignedId || null,
                        userProfile: reviewer,
                        note: actionNote || null,
                      })
                      setActionNote('')
                    }}
                      disabled={!currentAssignedId}
                      className="w-full py-2 rounded-md text-sm font-semibold flex items-center justify-center gap-2 transition-opacity"
                      style={{
                        backgroundColor: currentAssignedId ? '#1D4ED8' : 'rgba(29,78,216,0.4)',
                        color: 'white',
                        cursor: currentAssignedId ? 'pointer' : 'not-allowed',
                      }}>
                      <CheckCircle size={14} /> Submit for Review
                    </button>
                  </div>
                )}

                {/* Reviewer / Admin: Approve */}
                {(permissions.canApprove) &&
                  dbStatus === 'in_review' && (
                  <button onClick={() => setShowApproveModal(true)}
                    className="w-full py-2 rounded-md text-sm font-semibold flex items-center justify-center gap-2"
                    style={{ backgroundColor: '#059669', color: 'white' }}>
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
                    className="w-full py-2 rounded-md text-sm font-semibold flex items-center justify-center gap-2"
                    style={{ backgroundColor: '#7C3AED', color: 'white' }}>
                    <CheckCircle size={14} /> Mark as Paid
                  </button>
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
    </div>
  )
}
