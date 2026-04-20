import { useState, useEffect, useMemo } from 'react'
import { ArrowRight, Loader, CheckCircle, Eye, Clock, DollarSign } from 'lucide-react'
import StatusBadge from './StatusBadge'
import NeedsAttentionPanel from './NeedsAttentionPanel'
import PortfolioTabs from './PortfolioTabs'
import { useAuth } from '../context/AuthContext'
import { normalizeWorkflowStatus } from '../data/demoUsers'
import { supabase } from '../lib/supabaseClient'
import { fetchRecentActivity } from '../api/auditApi'
import { fmt, fmtFull } from '../lib/format'

function relativeTime(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function timeGroup(ts) {
  if (!ts) return 'Earlier'
  const now = new Date()
  const then = new Date(ts)
  const diffDays = Math.floor((now - then) / (1000 * 60 * 60 * 24))
  if (diffDays === 0 && now.getDate() === then.getDate()) return 'Today'
  if (diffDays <= 1) return 'Yesterday'
  return 'Earlier'
}

const ACTION_LABELS = {
  submit_for_review: 'submitted for review',
  approve: 'approved',
  reject: 'returned',
  send_back: 'sent back',
  mark_paid: 'marked paid',
  assign: 'assigned',
  edit: 'updated',
  reopen: 'reopened',
}

export default function Dashboard({
  invoices,
  onSelectInvoice,
  setActiveView,
  onAction,
  portfolioTabs = [],
  portfolioFilter = 'all',
  onPortfolioChange,
}) {
  const { isMockMode, role, permissions } = useAuth()
  const [activity, setActivity] = useState([])
  const [loadingActivity, setLoadingActivity] = useState(true)

  useEffect(() => {
    if (isMockMode || !supabase) { setLoadingActivity(false); return }
    fetchRecentActivity(12)
      .then(setActivity)
      .catch(console.error)
      .finally(() => setLoadingActivity(false))
  }, [isMockMode])

  const stats = useMemo(() => {
    const byStatus = { uploaded: [], in_review: [], approved: [], paid: [] }
    for (const inv of invoices) {
      const s = normalizeWorkflowStatus(inv.status)
      if (byStatus[s]) byStatus[s].push(inv)
    }
    const sum = (arr) => arr.reduce((t, i) => t + (Number(i.amount) || 0), 0)
    const pending = [...byStatus.uploaded, ...byStatus.in_review]
    return {
      pending: { count: pending.length, value: sum(pending) },
      inReview: { count: byStatus.in_review.length, value: sum(byStatus.in_review) },
      approved: { count: byStatus.approved.length, value: sum(byStatus.approved) },
      paid: { count: byStatus.paid.length, value: sum(byStatus.paid) },
      total: { count: invoices.length, value: sum(invoices) },
    }
  }, [invoices])

  // Group activity by time period
  const activityGroups = useMemo(() => {
    const grouped = {}
    for (const entry of activity) {
      const g = timeGroup(entry.created_at)
      if (!grouped[g]) grouped[g] = []
      grouped[g].push(entry)
    }
    return Object.entries(grouped)
  }, [activity])

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const pipelineCards = [
    { label: 'Pending',      count: stats.pending.count,  value: stats.pending.value,  view: 'invoices',   icon: Clock },
    { label: 'In Review',    count: stats.inReview.count, value: stats.inReview.value, view: 'review',     icon: Eye },
    { label: 'Ready to Pay', count: stats.approved.count, value: stats.approved.value, view: 'accounting', icon: CheckCircle },
    { label: 'Paid',         count: stats.paid.count,     value: stats.paid.value,     view: 'paid',       icon: DollarSign },
  ]
  const roleSummary = {
    ops: 'Watch for new uploads, assign owners, and keep the intake queue moving.',
    approver: 'Review routed invoices, approve clean ones, and send back anything unclear.',
    accounting: 'Monitor approved invoices and close the payment loop.',
    admin: 'Oversee the full workflow and step in wherever the team needs coverage.',
  }[role] || 'Track invoice workflow across the pilot.'

  return (
    <div className="p-6 fade-in" style={{ maxWidth: '960px' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-base font-semibold" style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            Command Center
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-7)' }}>{today}</p>
          <p className="text-sm mt-2" style={{ color: 'var(--text-5)' }}>{roleSummary}</p>
        </div>
        <button onClick={() => setActiveView('invoices')}
          className="flex items-center gap-1 text-xs transition-colors duration-150"
          style={{ color: 'var(--text-6)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-4)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-6)'}>
          All invoices <ArrowRight size={10} />
        </button>
      </div>

      <PortfolioTabs
        tabs={portfolioTabs}
        selected={portfolioFilter}
        onChange={onPortfolioChange}
        className="mb-5"
      />

      {/* ── SECTION 1: NEEDS ATTENTION ──────────────────────────────── */}
      <NeedsAttentionPanel
        invoices={invoices}
        onAction={onAction}
        onSelectInvoice={onSelectInvoice}
      />

      {/* ── SECTION 2: PIPELINE ─────────────────────────────────────── */}
      <div className="mt-8">
        <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-7)' }}>
          Pipeline
        </p>

        <div className="grid grid-cols-4 gap-px rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {pipelineCards.map((card, i) => {
            const Icon = card.icon
            return (
              <button key={i} onClick={() => setActiveView(card.view)}
                className="text-left p-4 transition-colors duration-150"
                style={{ backgroundColor: 'transparent', borderRight: i < 3 ? '1px solid var(--border)' : 'none' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--hover-sm)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon size={11} style={{ color: 'var(--text-7)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-6)' }}>{card.label}</span>
                </div>
                <p className="text-xl font-semibold tabular-nums" style={{ color: 'var(--text-1)', letterSpacing: '-0.03em' }}>
                  {card.count}
                </p>
                <p className="text-xs mt-0.5 tabular-nums" style={{ color: 'var(--text-7)' }}>
                  {fmt(card.value)}
                </p>
              </button>
            )
          })}
        </div>

        {/* Pipeline bar */}
        {stats.total.value > 0 && (
          <div className="mt-2 flex rounded overflow-hidden h-1" style={{ backgroundColor: 'var(--border)' }}>
            {[
              { value: stats.pending.value, color: 'var(--text-7)' },
              { value: stats.inReview.value, color: '#3B82F6' },
              { value: stats.approved.value, color: '#10B981' },
              { value: stats.paid.value, color: 'var(--border-strong)' },
            ].map((seg, i) => {
              const pct = (seg.value / stats.total.value) * 100
              if (pct < 0.5) return null
              return <div key={i} style={{ width: `${pct}%`, backgroundColor: seg.color, transition: 'width 0.3s ease' }} />
            })}
          </div>
        )}
      </div>

      {/* ── SECTION 3: ACTIVITY ─────────────────────────────────────── */}
      <div className="mt-8">
        <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-7)' }}>
          Activity
        </p>

        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {loadingActivity ? (
            <div className="flex items-center justify-center py-8">
              <Loader size={13} className="spin-slow" style={{ color: 'var(--text-7)' }} />
            </div>
          ) : activity.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs" style={{ color: 'var(--text-7)' }}>
                {isMockMode ? 'Connect Supabase for activity' : 'No activity yet'}
              </p>
            </div>
          ) : (
            <div>
              {activityGroups.map(([groupLabel, entries], gi) => (
                <div key={groupLabel}>
                  {/* Time group header */}
                  <div className="px-4 pt-2.5 pb-1"
                    style={{ borderTop: gi > 0 ? '1px solid var(--border)' : 'none' }}>
                    <span className="text-xs font-medium" style={{ color: 'var(--text-7)' }}>{groupLabel}</span>
                  </div>

                  {entries.map((entry, i) => {
                    const actorName = entry.user?.full_name || entry.user?.email?.split('@')[0] || 'System'
                    const invNum = entry.invoice?.invoice_number || (entry.invoice?.id ? entry.invoice.id.slice(0, 8) : '—')
                    const vendorName = entry.invoice?.vendor_name || ''
                    const amount = entry.invoice?.amount != null ? fmtFull(entry.invoice.amount) : ''
                    const property = entry.invoice?.property_name || ''
                    const label = ACTION_LABELS[entry.action] || entry.action

                    return (
                      <div key={entry.id}
                        onClick={() => entry.invoice && onSelectInvoice(entry.invoice)}
                        className="flex items-baseline gap-3 px-4 py-1.5 cursor-pointer transition-colors duration-150"
                        style={{ backgroundColor: 'transparent' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--hover-xs)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs" style={{ color: 'var(--text-4)' }}>
                            <span className="font-medium" style={{ color: 'var(--text-3)' }}>{actorName}</span>
                            {' '}{label}{' '}
                            <span className="font-mono" style={{ color: 'var(--text-5)' }}>#{invNum}</span>
                            {amount && <span className="tabular-nums"> · {amount}</span>}
                            {vendorName && <span> · {vendorName}</span>}
                            {property && <span style={{ color: 'var(--text-6)' }}> · {property}</span>}
                          </span>
                        </div>
                        <span className="text-xs flex-shrink-0 tabular-nums" style={{ color: 'var(--text-7)' }}>
                          {relativeTime(entry.created_at)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── RECENT INVOICES ─────────────────────────────────────────── */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-7)' }}>
            Recent Invoices
          </p>
          <button onClick={() => setActiveView('invoices')}
            className="text-xs flex items-center gap-1 transition-colors duration-150"
            style={{ color: 'var(--text-6)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-4)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-6)'}>
            View all <ArrowRight size={10} />
          </button>
        </div>

        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Invoice', 'Vendor', 'Property', 'Amount', 'Status'].map(col => (
                  <th key={col} className="text-left px-4 py-2 text-xs"
                    style={{ color: 'var(--text-7)' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.slice(0, 5).map((inv, i) => (
                <tr key={inv.id} onClick={() => onSelectInvoice(inv)}
                  className="cursor-pointer transition-colors duration-150"
                  style={{ borderBottom: i < 4 ? '1px solid var(--border-subtle)' : 'none', backgroundColor: 'transparent' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--hover-xs)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                  <td className="px-4 py-2">
                    <span className="font-mono text-xs" style={{ color: 'var(--text-5)' }}>
                      {inv.invoice_number || (typeof inv.id === 'string' && inv.id.length > 10 ? inv.id.slice(0, 8) : inv.id)}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{inv.vendor_name}</span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-xs" style={{ color: 'var(--text-6)' }}>{inv.property_name || '—'}</span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-xs tabular-nums" style={{ color: 'var(--text-3)' }}>
                      {inv.amount != null ? fmtFull(inv.amount) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2"><StatusBadge status={inv.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {invoices.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm font-medium" style={{ color: 'var(--text-4)' }}>No invoices yet</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-7)' }}>
                {permissions.canUpload
                  ? 'Upload the first invoice to start the workflow.'
                  : 'Once Ops uploads invoices, the dashboard will start reflecting your queue.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
