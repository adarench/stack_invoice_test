import { useState, useMemo, useEffect } from 'react'
import { Check, Loader } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { normalizeWorkflowStatus } from '../data/demoUsers'
import { fetchPrimaryUser } from '../api/userApi'
import { allocationBlockReason, normalizeGlSplits } from '../lib/invoiceAccounting'
import { fmtFull as fmt } from '../lib/format'

function ageInDays(dateStr) {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

function ageLabel(days) {
  if (days === null) return ''
  if (days === 0) return 'today'
  if (days === 1) return '1 day'
  return `${days} days`
}

export default function NeedsAttentionPanel({ invoices, onAction, onSelectInvoice }) {
  const { user, role } = useAuth()
  const [acting, setActing] = useState(null)
  const [completed, setCompleted] = useState(new Set())
  const [defaultApprover, setDefaultApprover] = useState(null)

  useEffect(() => {
    fetchPrimaryUser('approver').then(setDefaultApprover).catch(console.error)
  }, [])

  const groups = useMemo(() => {
    const now = new Date()
    const overdue = []
    const stuck = []
    const unassigned = []

    for (const inv of invoices) {
      const status = normalizeWorkflowStatus(inv.status)
      const uploadAge = ageInDays(inv.created_at)
      const actionAge = ageInDays(inv.last_action_at || inv.created_at)

      // Overdue: approved + past due
      if (
        status === 'approved' &&
        !allocationBlockReason(inv.amount, normalizeGlSplits(inv.gl_splits, inv)) &&
        (role === 'accounting' || role === 'admin')
      ) {
        const approvedAge = ageInDays(inv.approved_at || inv.last_action_at || inv.created_at)
        const isOverdue = inv.due_date && new Date(inv.due_date) < now

        if (isOverdue || approvedAge >= 3) {
          overdue.push({
            id: `payment-${inv.id}`,
            invoice: inv,
            severity: isOverdue ? 'critical' : 'warning',
            reason: isOverdue ? `Due ${inv.due_date}` : `Approved ${ageLabel(approvedAge)} ago`,
            actionLabel: 'Mark as Paid',
            action: async () => { await onAction(inv.id, 'mark_paid') },
          })
        }
      }

      // Stuck in review
      if (status === 'in_review' && actionAge >= 2 &&
          !allocationBlockReason(inv.amount, normalizeGlSplits(inv.gl_splits, inv)) &&
          (role === 'approver' || role === 'admin') &&
          (inv.assigned_to === user?.id || inv.assigned_reviewer_id === user?.id || role === 'admin')) {
        stuck.push({
          id: `review-${inv.id}`,
          invoice: inv,
          severity: actionAge >= 5 ? 'critical' : 'warning',
          reason: `In review for ${ageLabel(actionAge)}`,
          actionLabel: 'Approve Invoice',
          action: async () => { await onAction(inv.id, 'approve', { note: 'Approved via Command Center' }) },
        })
      }

      // Unassigned
      if (status === 'uploaded' && !inv.assigned_to && uploadAge >= 1 &&
          (role === 'ops' || role === 'admin')) {
        unassigned.push({
          id: `unassigned-${inv.id}`,
          invoice: inv,
          severity: uploadAge >= 3 ? 'critical' : uploadAge >= 2 ? 'warning' : 'info',
          reason: `Unassigned for ${ageLabel(uploadAge)}`,
          actionLabel: 'Assign to Approver',
          action: async () => {
            await onAction(inv.id, 'submit_for_review', {
              userId: defaultApprover?.id,
              userProfile: defaultApprover,
            })
          },
        })
      }
    }

    const result = []
    if (overdue.length > 0) result.push({ label: 'Overdue', items: overdue })
    if (stuck.length > 0) result.push({ label: 'Stuck in Review', items: stuck })
    if (unassigned.length > 0) result.push({ label: 'Unassigned', items: unassigned })
    return result
  }, [invoices, user, role, onAction, defaultApprover])

  const totalCount = groups.reduce((t, g) => t + g.items.length, 0)
  if (totalCount === 0) return null

  const handleAction = async (item, e) => {
    e.stopPropagation()
    setActing(item.id)
    try {
      await item.action()
      setCompleted(prev => new Set(prev).add(item.id))
      setTimeout(() => setCompleted(prev => { const next = new Set(prev); next.delete(item.id); return next }), 1500)
    } catch (err) {
      console.error('Action failed:', err)
    } finally {
      setActing(null)
    }
  }

  const dotColor = { critical: '#EF4444', warning: '#F59E0B', info: '#6B7280' }

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-5)' }}>
          Needs Attention
        </span>
        <span className="text-xs tabular-nums" style={{ color: 'var(--text-6)' }}>
          {totalCount}
        </span>
      </div>

      {groups.map((group, gi) => (
        <div key={group.label}>
          {/* Group label */}
          <div className="px-4 pt-3 pb-1.5"
            style={{ borderTop: gi > 0 ? '1px solid var(--border)' : 'none' }}>
            <span className="text-xs font-medium" style={{ color: 'var(--text-6)' }}>
              {group.label}
              <span className="ml-1.5 tabular-nums" style={{ color: 'var(--text-7)' }}>{group.items.length}</span>
            </span>
          </div>

          {/* Items */}
          {group.items.slice(0, 5).map((item, i) => {
            const inv = item.invoice
            const isActing = acting === item.id
            const isDone = completed.has(item.id)

            return (
              <div key={item.id}
                onClick={() => onSelectInvoice?.(inv)}
                className="flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors duration-150"
                style={{ backgroundColor: 'transparent' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--hover-xs)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>

                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: dotColor[item.severity] }} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-xs" style={{ color: 'var(--text-4)' }}>
                      #{inv.invoice_number || inv.id?.slice?.(0, 8)}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-6)' }}>—</span>
                    <span className="text-xs font-medium truncate" style={{ color: 'var(--text-2)' }}>
                      {inv.vendor_name}
                    </span>
                    {inv.amount != null && (
                      <span className="text-xs tabular-nums ml-auto flex-shrink-0" style={{ color: 'var(--text-3)' }}>
                        {fmt(inv.amount)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-px" style={{ color: 'var(--text-6)' }}>
                    <span style={{ color: dotColor[item.severity] }}>{item.reason}</span>
                    {inv.property_name && ` · ${inv.property_name}`}
                  </p>
                </div>

                <button
                  onClick={(e) => handleAction(item, e)}
                  disabled={isActing || isDone}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all duration-150 flex-shrink-0"
                  style={{
                    backgroundColor: isDone ? 'rgba(16,185,129,0.1)' : 'transparent',
                    color: isDone ? '#10B981' : 'var(--text-5)',
                    border: `1px solid ${isDone ? 'rgba(16,185,129,0.3)' : 'var(--border-strong)'}`,
                    cursor: isActing ? 'wait' : isDone ? 'default' : 'pointer',
                  }}
                  onMouseEnter={e => { if (!isActing && !isDone) e.currentTarget.style.borderColor = 'var(--text-5)' }}
                  onMouseLeave={e => { if (!isDone) e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                >
                  {isActing ? <Loader size={10} className="spin-slow" /> : isDone ? <Check size={10} /> : null}
                  {isDone ? 'Done' : item.actionLabel}
                </button>
              </div>
            )
          })}
          {group.items.length > 5 && (
            <div className="px-4 py-1.5">
              <span className="text-xs" style={{ color: 'var(--text-7)' }}>+{group.items.length - 5} more</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
