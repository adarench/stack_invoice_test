import { useState, useMemo } from 'react'
import { AlertTriangle, Clock, CheckCircle, FileText, X, ArrowRight } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { normalizeWorkflowStatus } from '../data/demoUsers'

export default function ActionRequiredBanner({ invoices, user, role, setActiveView }) {
  const { isDark } = useTheme()
  const [dismissed, setDismissed] = useState(false)

  const alerts = useMemo(() => {
    if (!invoices || !user) return []
    const items = []
    const now = new Date()

    const normalized = invoices.map(i => ({
      ...i,
      _status: normalizeWorkflowStatus(i.status),
    }))

    // ── Ops / Uploader alerts ──────────────────────────────────────────────
    if (role === 'uploader' || role === 'admin') {
      const needsAssignment = normalized.filter(i =>
        i._status === 'uploaded' && !i.assigned_to
      )
      if (needsAssignment.length > 0) {
        items.push({
          id: 'needs-assignment',
          icon: FileText,
          color: '#F59E0B',
          bg: 'rgba(245,158,11,0.08)',
          border: 'rgba(245,158,11,0.25)',
          text: `${needsAssignment.length} invoice${needsAssignment.length !== 1 ? 's' : ''} need${needsAssignment.length === 1 ? 's' : ''} assignment`,
          action: () => setActiveView('invoices'),
        })
      }

      // Sent-back invoices: uploaded status but last_action_at > created_at (been through workflow)
      const sentBack = normalized.filter(i =>
        i._status === 'uploaded' && i.last_action_at && i.created_at &&
        new Date(i.last_action_at) > new Date(i.created_at)
      )
      if (sentBack.length > 0) {
        items.push({
          id: 'sent-back',
          icon: AlertTriangle,
          color: '#EF4444',
          bg: 'rgba(239,68,68,0.08)',
          border: 'rgba(239,68,68,0.25)',
          text: `${sentBack.length} invoice${sentBack.length !== 1 ? 's' : ''} sent back for revision`,
          action: () => setActiveView('invoices'),
        })
      }
    }

    // ── Reviewer alerts ────────────────────────────────────────────────────
    if (role === 'reviewer' || role === 'admin') {
      const needsReview = normalized.filter(i =>
        i._status === 'in_review' && (
          i.assigned_to === user.id ||
          i.assigned_reviewer_id === user.id
        )
      )
      if (needsReview.length > 0) {
        items.push({
          id: 'needs-review',
          icon: Clock,
          color: '#3B82F6',
          bg: 'rgba(59,130,246,0.08)',
          border: 'rgba(59,130,246,0.25)',
          text: `${needsReview.length} invoice${needsReview.length !== 1 ? 's' : ''} need${needsReview.length === 1 ? 's' : ''} your review`,
          action: () => setActiveView('review'),
        })
      }
    }

    // ── Accounting alerts ──────────────────────────────────────────────────
    if (role === 'accounting' || role === 'admin') {
      const readyForPayment = normalized.filter(i => i._status === 'approved')
      if (readyForPayment.length > 0) {
        items.push({
          id: 'ready-payment',
          icon: CheckCircle,
          color: '#10B981',
          bg: 'rgba(16,185,129,0.08)',
          border: 'rgba(16,185,129,0.25)',
          text: `${readyForPayment.length} approved invoice${readyForPayment.length !== 1 ? 's' : ''} ready for payment`,
          action: () => setActiveView('accounting'),
        })
      }

      const overdue = normalized.filter(i =>
        i._status === 'approved' && i.due_date && new Date(i.due_date) < now
      )
      if (overdue.length > 0) {
        items.push({
          id: 'overdue',
          icon: AlertTriangle,
          color: '#EF4444',
          bg: 'rgba(239,68,68,0.08)',
          border: 'rgba(239,68,68,0.25)',
          text: `${overdue.length} invoice${overdue.length !== 1 ? 's' : ''} overdue`,
          action: () => setActiveView('accounting'),
        })
      }
    }

    return items
  }, [invoices, user, role, setActiveView])

  // Don't render for vendor role or when dismissed or nothing to show
  if (role === 'vendor' || dismissed || alerts.length === 0) return null

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 flex-shrink-0 overflow-x-auto"
      style={{
        backgroundColor: isDark ? 'rgba(245,158,11,0.04)' : 'rgba(245,158,11,0.03)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <span className="text-xs font-semibold uppercase tracking-wider flex-shrink-0"
        style={{ color: 'var(--text-6)' }}>
        Action needed
      </span>

      <div className="flex items-center gap-2 flex-1 overflow-x-auto">
        {alerts.map(alert => {
          const Icon = alert.icon
          return (
            <button
              key={alert.id}
              onClick={alert.action}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex-shrink-0"
              style={{
                backgroundColor: alert.bg,
                color: alert.color,
                border: `1px solid ${alert.border}`,
              }}
            >
              <Icon size={12} />
              {alert.text}
              <ArrowRight size={10} style={{ opacity: 0.6 }} />
            </button>
          )
        })}
      </div>

      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 p-1 rounded transition-colors"
        style={{ color: 'var(--text-6)' }}
        title="Dismiss for this session"
      >
        <X size={12} />
      </button>
    </div>
  )
}
