import { useState, useMemo, useEffect } from 'react'
import { X, Loader, Check } from 'lucide-react'
import { normalizeWorkflowStatus } from '../data/demoUsers'
import { fetchPrimaryUser } from '../api/userApi'
import { allocationBlockReason, normalizeGlSplits } from '../lib/invoiceAccounting'
const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

export default function ActionRequiredBanner({ invoices, user, role, setActiveView, onAction }) {
  const [dismissed, setDismissed] = useState(false)
  const [acting, setActing] = useState(null)
  const [completed, setCompleted] = useState(null)
  const [defaultApprover, setDefaultApprover] = useState(null)

  useEffect(() => {
    fetchPrimaryUser('approver').then(setDefaultApprover).catch(console.error)
  }, [])

  const alerts = useMemo(() => {
    if (!invoices || !user) return []
    const items = []
    const now = new Date()
    const normalized = invoices.map(i => ({ ...i, _status: normalizeWorkflowStatus(i.status) }))

    if (role === 'ops' || role === 'admin') {
      const unassigned = normalized.filter(i => i._status === 'uploaded' && !i.assigned_to)
      if (unassigned.length > 0) {
        items.push({
          id: 'assign',
          label: `Assign (${unassigned.length})`,
          canAct: true,
          run: async () => {
            for (const inv of unassigned) {
              await onAction(inv.id, 'submit_for_review', { userId: defaultApprover?.id, userProfile: defaultApprover })
            }
          },
          fallback: () => setActiveView('invoices'),
        })
      }
    }

    if (role === 'approver' || role === 'admin') {
      const review = normalized.filter(i =>
        i._status === 'in_review' && (i.assigned_to === user.id || i.assigned_reviewer_id === user.id || role === 'admin')
      )
      if (review.length > 0) {
        items.push({
          id: 'review',
          label: `Review (${review.length})`,
          canAct: false,
          fallback: () => setActiveView('review'),
        })
      }
    }

    if (role === 'accounting' || role === 'admin') {
      const ready = normalized.filter(i =>
        i._status === 'approved' &&
        !allocationBlockReason(i.amount, normalizeGlSplits(i.gl_splits, i))
      )
      if (ready.length > 0) {
        items.push({
          id: 'pay',
          label: `Pay (${ready.length})`,
          canAct: true,
          run: async () => {
            for (const inv of ready) await onAction(inv.id, 'mark_paid')
          },
          fallback: () => setActiveView('accounting'),
        })
      }

      const overdue = normalized.filter(i => i._status === 'approved' && i.due_date && new Date(i.due_date) < now)
      if (overdue.length > 0) {
        items.push({
          id: 'overdue',
          label: `Overdue (${overdue.length})`,
          canAct: false,
          isWarning: true,
          fallback: () => setActiveView('accounting'),
        })
      }
    }

    return items
  }, [invoices, user, role, setActiveView, onAction])

  if (role === 'vendor' || dismissed || alerts.length === 0) return null

  const handleClick = async (alert) => {
    if (alert.canAct && alert.run) {
      setActing(alert.id)
      try {
        await alert.run()
        setCompleted(alert.id)
        setTimeout(() => setCompleted(null), 1500)
      } catch (err) { console.error('Bulk action failed:', err) }
      finally { setActing(null) }
    } else {
      alert.fallback?.()
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 flex-shrink-0"
      style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-7)' }}>Actions</span>

      <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
        {alerts.map(alert => {
          const isActing = acting === alert.id
          const isDone = completed === alert.id
          return (
            <button key={alert.id}
              onClick={() => handleClick(alert)}
              disabled={isActing || isDone}
              className="flex items-center gap-1.5 h-6 px-2.5 rounded text-xs font-medium transition-all duration-150 flex-shrink-0"
              style={{
                backgroundColor: isDone ? 'rgba(16,185,129,0.08)' : 'transparent',
                color: isDone ? '#10B981' : alert.isWarning ? '#EF4444' : 'var(--text-4)',
                border: `1px solid ${isDone ? 'rgba(16,185,129,0.25)' : alert.isWarning ? 'rgba(239,68,68,0.25)' : 'var(--border-strong)'}`,
                cursor: isActing ? 'wait' : isDone ? 'default' : 'pointer',
              }}
              onMouseEnter={e => { if (!isActing && !isDone) e.currentTarget.style.borderColor = alert.isWarning ? 'rgba(239,68,68,0.5)' : 'var(--text-6)' }}
              onMouseLeave={e => { if (!isDone) e.currentTarget.style.borderColor = alert.isWarning ? 'rgba(239,68,68,0.25)' : 'var(--border-strong)' }}>
              {isActing ? <Loader size={10} className="spin-slow" /> : isDone ? <Check size={10} /> : null}
              {isDone ? 'Done' : alert.label}
            </button>
          )
        })}
      </div>

      <button onClick={() => setDismissed(true)}
        className="flex-shrink-0 p-1 rounded transition-colors duration-150"
        style={{ color: 'var(--text-7)' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-5)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-7)'}>
        <X size={11} />
      </button>
    </div>
  )
}
