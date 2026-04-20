import { useState, useMemo, useEffect, useRef } from 'react'
import { Search, Filter, Upload, ChevronDown, ChevronUp, AlertTriangle, User, CheckCircle, Clock, DollarSign, Loader, Check, Trash2 } from 'lucide-react'
import StatusBadge from './StatusBadge'
import PortfolioTabs from './PortfolioTabs'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { WORKFLOW_STATUSES, normalizeWorkflowStatus } from '../data/demoUsers'
import { fetchPrimaryUser } from '../api/userApi'
import { allocationBlockReason, normalizeGlSplits } from '../lib/invoiceAccounting'

function normalizeStatus(status) {
  return WORKFLOW_STATUSES[normalizeWorkflowStatus(status)] || status
}

function ageInDays(dateStr) {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

export default function InvoiceList({
  invoices,
  onSelectInvoice,
  onUploadClick,
  onAction,
  title = 'Invoices',
  queueMode = 'all',
  searchQuery,
  onSearchChange,
  portfolioTabs = [],
  portfolioFilter = 'all',
  onPortfolioChange,
}) {
  const { isDark } = useTheme()
  const { user, role, permissions } = useAuth()
  const [defaultApprover, setDefaultApprover] = useState(null)
  const [localSearch, setLocalSearch] = useState('')
  const [assignmentFilter, setAssignmentFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sortCol, setSortCol] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  const [selected, setSelected] = useState(new Set())
  const [bulkActing, setBulkActing] = useState(false)
  const [colWidths, setColWidths] = useState({
    _select: 40, id: 180, vendor_name: 220, property_name: 200,
    amount: 130, status: 130, assigned_to: 160, _age: 80,
  })
  const resizingRef = useRef(null)

  const startResize = (e, key) => {
    e.preventDefault()
    e.stopPropagation()
    resizingRef.current = { key, startX: e.clientX, startWidth: colWidths[key] ?? 100 }
    const onMove = (evt) => {
      const ctx = resizingRef.current
      if (!ctx) return
      const next = Math.max(40, ctx.startWidth + (evt.clientX - ctx.startX))
      setColWidths(prev => ({ ...prev, [ctx.key]: next }))
    }
    const onUp = () => {
      resizingRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  useEffect(() => {
    fetchPrimaryUser('approver').then(setDefaultApprover).catch(console.error)
  }, [])

  const search = typeof searchQuery === 'string' ? searchQuery : localSearch
  const setSearch = typeof onSearchChange === 'function' ? onSearchChange : setLocalSearch

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const toggleSelect = (id, e) => {
    e.stopPropagation()
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(i => i.id)))
  }

  const assignmentTabs = queueMode === 'all'
    ? [
        { key: 'All', label: 'All' },
        { key: 'Mine', label: 'Assigned to me' },
        { key: 'Unassigned', label: 'Unassigned' },
        { key: 'In Review', label: 'In Review' },
      ]
    : queueMode === 'my-queue'
      ? [
          { key: 'All', label: 'All' },
          { key: 'Mine', label: 'Assigned to me' },
        ]
      : []

  const filtered = invoices
    .filter(inv => {
      const q = search.toLowerCase()
      if (q) {
        const searchable = [
          inv.vendor_name,
          inv.property_name,
          inv.id,
          inv.invoice_number,
          inv.description,
          inv.bill_to_name,
        ]
          .filter(Boolean).map(s => s.toLowerCase())
        if (!searchable.some(s => s.includes(q))) return false
      }
      if (typeFilter !== 'All' && inv.invoice_type !== typeFilter) return false
      if (statusFilter !== 'All') {
        const normalized = normalizeStatus(inv.status)
        if (normalized !== statusFilter) return false
      }
      if (assignmentFilter === 'Mine') {
        if (inv.assigned_to !== user?.id && inv.assigned_user?.id !== user?.id) return false
      }
      if (assignmentFilter === 'Unassigned') {
        if (inv.assigned_to || inv.assigned_user) return false
      }
      if (assignmentFilter === 'In Review') {
        if (normalizeWorkflowStatus(inv.status) !== 'in_review') return false
      }
      return true
    })
    .sort((a, b) => {
      const col = sortCol === 'created_at' ? (a.created_at ? 'created_at' : 'invoice_date') : sortCol
      let av = a[col], bv = b[col]
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av === undefined || av === null) return 1
      if (bv === undefined || bv === null) return -1
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  // Determine what bulk actions are available for selected invoices
  const selectedInvoices = filtered.filter(i => selected.has(i.id))
  const bulkActions = useMemo(() => {
    if (selectedInvoices.length === 0) return []
    const actions = []
    const statuses = new Set(selectedInvoices.map(i => normalizeWorkflowStatus(i.status)))

    // All uploaded + unassigned → can bulk assign
    if (statuses.size === 1 && statuses.has('uploaded') &&
        selectedInvoices.every(i => !i.assigned_to) &&
        (role === 'ops' || role === 'admin')) {
      actions.push({
        id: 'bulk-assign',
        label: `Assign ${selectedInvoices.length} to ${defaultApprover?.full_name || 'Approver'}`,
        icon: User,
        color: '#F59E0B',
        run: async () => {
          for (const inv of selectedInvoices) {
            await onAction(inv.id, 'submit_for_review', {
              userId: defaultApprover?.id,
              userProfile: defaultApprover,
            })
          }
        },
      })
    }

    // All in_review → can bulk approve
    if (statuses.size === 1 && statuses.has('in_review') &&
        (role === 'approver' || role === 'admin') &&
        selectedInvoices.every(i => !allocationBlockReason(i.amount, normalizeGlSplits(i.gl_splits, i)))) {
      actions.push({
        id: 'bulk-approve',
        label: `Approve ${selectedInvoices.length}`,
        icon: CheckCircle,
        color: '#10B981',
        run: async () => {
          for (const inv of selectedInvoices) {
            await onAction(inv.id, 'approve', { note: 'Bulk approved' })
          }
        },
      })
    }

    // All approved → can bulk mark paid
    if (statuses.size === 1 && statuses.has('approved') &&
        (role === 'accounting' || role === 'admin') &&
        selectedInvoices.every(i => !allocationBlockReason(i.amount, normalizeGlSplits(i.gl_splits, i)))) {
      actions.push({
        id: 'bulk-paid',
        label: `Mark ${selectedInvoices.length} paid`,
        icon: DollarSign,
        color: '#8B5CF6',
        run: async () => {
          for (const inv of selectedInvoices) {
            await onAction(inv.id, 'mark_paid')
          }
        },
      })
    }

    actions.push({
      id: 'bulk-delete',
      label: `Delete ${selectedInvoices.length}`,
      icon: Trash2,
      color: '#DC2626',
      confirmLabel: `Delete ${selectedInvoices.length} invoice${selectedInvoices.length > 1 ? 's' : ''}? This cannot be undone.`,
      run: async () => {
        for (const inv of selectedInvoices) {
          await onAction(inv.id, 'delete')
        }
      },
    })

    return actions
  }, [selectedInvoices, role, onAction, defaultApprover])

  const handleBulkAction = async (action) => {
    if (action.confirmLabel && !window.confirm(action.confirmLabel)) return
    setBulkActing(true)
    try {
      await action.run()
      setSelected(new Set())
    } catch (err) {
      console.error('Bulk action failed:', err)
    } finally {
      setBulkActing(false)
    }
  }

  const cols = [
    { key: '_select',        label: '',         sortable: false, width: '36px' },
    { key: 'id',             label: 'Invoice',  sortable: true },
    { key: 'vendor_name',    label: 'Vendor',   sortable: true },
    { key: 'property_name',  label: 'Property', sortable: true },
    { key: 'amount',         label: 'Amount',   sortable: true },
    { key: 'status',         label: 'Status',   sortable: true },
    { key: 'assigned_to',    label: 'Assigned', sortable: false },
    { key: '_age',           label: 'Age',      sortable: false },
  ]

  const statuses = ['All', ...Array.from(new Set(invoices.map(i => normalizeStatus(i.status))))]
  const types = ['All', 'Work Order', 'Contract', 'Utility']
  const canUpload = permissions.canUpload && typeof onUploadClick === 'function'

  const helperText = {
    all: 'Browse the full invoice pipeline and narrow down by assignment or status.',
    'my-queue': 'Focus on invoices assigned to you or uploaded by you.',
    review: role === 'approver' || role === 'admin'
      ? 'Review-ready invoices live here. If nothing is assigned yet, Ops needs to route work into review.'
      : 'Invoices currently in review.',
    accounting: 'Approved invoices are ready for payment processing here.',
    paid: 'Completed payments are recorded here for audit and reference.',
  }[queueMode] || 'Track invoices by workflow stage.'

  const emptyState = {
    all: {
      title: 'No invoices yet',
      body: canUpload
        ? 'Start the pilot by uploading the first invoice so the workflow has data to route.'
        : 'No invoices have been uploaded yet. Ask Ops to upload the first invoice to start the workflow.',
      cta: canUpload ? 'Upload Invoice' : null,
    },
    'my-queue': {
      title: 'Nothing in your queue',
      body: role === 'approver'
        ? 'You do not have any invoices assigned for review yet.'
        : role === 'accounting'
          ? 'You do not have any invoices waiting on your payment workflow yet.'
          : 'You do not have any invoices assigned to you yet.',
      cta: canUpload ? 'Upload Invoice' : null,
    },
    review: {
      title: 'No invoices in review',
      body: role === 'approver'
        ? 'Ops has not submitted any invoices into review yet, or nothing is assigned to you.'
        : 'There are currently no invoices in the review stage.',
      cta: null,
    },
    accounting: {
      title: 'Nothing ready to pay',
      body: 'No approved invoices are waiting for accounting yet.',
      cta: null,
    },
    paid: {
      title: 'No paid invoices yet',
      body: 'Paid invoices will appear here once the accounting workflow is completed.',
      cta: null,
    },
  }[queueMode] || {
    title: 'No invoices yet',
    body: 'This view is empty right now.',
    cta: canUpload ? 'Upload Invoice' : null,
  }

  const activeEmptyState = search
    ? {
        title: 'No matching invoices',
        body: `No invoices matched "${search}". Search by invoice number, vendor name, or property name.`,
        cta: null,
      }
    : emptyState

  return (
    <div className="p-6 fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            {title}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-5)' }}>
            {helperText}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-6)' }}>
            {filtered.length} shown
            {search && ` for "${search}"`}
            {` · ${invoices.length} total`}
            {invoices.filter(i => !i.assigned_to && normalizeWorkflowStatus(i.status) === 'uploaded').length > 0 &&
              ` · ${invoices.filter(i => !i.assigned_to && normalizeWorkflowStatus(i.status) === 'uploaded').length} unassigned`}
          </p>
        </div>
        {canUpload && (
          <button onClick={onUploadClick}
            className="flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors"
            style={{ backgroundColor: '#1D4ED8', color: 'white' }}>
            <Upload size={13} /> Upload Invoice
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-lg"
          style={{
            backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(37,99,235,0.06)',
            border: '1px solid rgba(59,130,246,0.25)',
          }}>
          <span className="text-xs font-semibold" style={{ color: '#3B82F6' }}>
            {selected.size} selected
          </span>

          {bulkActions.map(action => {
            const Icon = action.icon
            return (
              <button key={action.id}
                onClick={() => handleBulkAction(action)}
                disabled={bulkActing}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all"
                style={{
                  backgroundColor: action.color,
                  color: 'white',
                  opacity: bulkActing ? 0.7 : 1,
                  cursor: bulkActing ? 'wait' : 'pointer',
                }}>
                {bulkActing ? <Loader size={10} className="spin-slow" /> : <Icon size={11} />}
                {action.label}
              </button>
            )
          })}

          {bulkActions.length === 0 && (
            <span className="text-xs" style={{ color: 'var(--text-5)' }}>
              Select invoices with same status for bulk actions
            </span>
          )}

          <button onClick={() => setSelected(new Set())}
            className="ml-auto text-xs font-medium" style={{ color: 'var(--text-5)' }}>
            Clear
          </button>
        </div>
      )}

      {/* Assignment filter tabs */}
      <PortfolioTabs
        tabs={portfolioTabs}
        selected={portfolioFilter}
        onChange={onPortfolioChange}
        className="mb-3"
      />

      {assignmentTabs.length > 0 && (
        <div className="flex gap-1 mb-3">
          {assignmentTabs.map(tab => (
            <button key={tab.key} onClick={() => setAssignmentFilter(tab.key)}
              className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
              style={{
                backgroundColor: assignmentFilter === tab.key
                  ? (isDark ? 'rgba(59,130,246,0.2)' : 'rgba(37,99,235,0.12)')
                  : 'transparent',
                color: assignmentFilter === tab.key ? '#3B82F6' : 'var(--text-5)',
                border: assignmentFilter === tab.key ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
              }}>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 p-3 rounded-lg themed"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Search size={13} style={{ color: 'var(--text-6)' }} />
          <input className="bg-transparent text-sm outline-none flex-1"
            placeholder="Search invoice number, vendor, property…"
            style={{ color: 'var(--text-2)', fontSize: '13px' }}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="h-4 w-px" style={{ backgroundColor: 'var(--border)' }} />
        <div className="flex items-center gap-2">
          <Filter size={12} style={{ color: 'var(--text-6)' }} />
          <span className="text-xs" style={{ color: 'var(--text-5)' }}>Type:</span>
          <div className="flex gap-1">
            {types.map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className="px-2.5 py-1 rounded text-xs font-medium transition-colors"
                style={{
                  backgroundColor: typeFilter === t ? 'rgba(59,130,246,0.2)' : 'transparent',
                  color: typeFilter === t ? '#3B82F6' : 'var(--text-5)',
                  border: typeFilter === t ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                }}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="h-4 w-px" style={{ backgroundColor: 'var(--border)' }} />
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-5)' }}>Status:</span>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="text-xs rounded px-2 py-1 outline-none"
            style={{ backgroundColor: 'var(--border)', color: 'var(--text-3)', border: 'none' }}>
            {statuses.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <span className="ml-auto text-xs" style={{ color: 'var(--text-6)' }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden themed"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ overflowX: 'auto' }}>
        <table style={{ tableLayout: 'fixed', width: '100%' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-alt)' }}>
              {cols.map(col => (
                <th key={col.key}
                  onClick={() => col.key === '_select' ? toggleAll() : col.sortable && handleSort(col.key)}
                  className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider select-none"
                  style={{
                    color: sortCol === col.key ? '#3B82F6' : 'var(--text-6)',
                    cursor: col.sortable || col.key === '_select' ? 'pointer' : 'default',
                    width: colWidths[col.key] || col.width || 'auto',
                    position: 'relative',
                  }}>
                  {col.key === '_select' ? (
                    <div className="w-4 h-4 rounded border flex items-center justify-center"
                      style={{
                        borderColor: selected.size === filtered.length && filtered.length > 0 ? '#3B82F6' : 'var(--border-strong)',
                        backgroundColor: selected.size === filtered.length && filtered.length > 0 ? '#3B82F6' : 'transparent',
                      }}>
                      {selected.size === filtered.length && filtered.length > 0 && <Check size={10} color="white" />}
                    </div>
                  ) : (
                    <span className="flex items-center gap-1">
                      {col.label}
                      {col.sortable && sortCol === col.key && (
                        sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                      )}
                    </span>
                  )}
                  <span
                    onMouseDown={(e) => startResize(e, col.key)}
                    onClick={(e) => e.stopPropagation()}
                    title="Drag to resize"
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      bottom: 0,
                      width: 6,
                      cursor: 'col-resize',
                      userSelect: 'none',
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv, i) => {
              const assignedUser = inv.assigned_user
              const displayStatus = normalizeStatus(inv.status)
              const nStatus = normalizeWorkflowStatus(inv.status)
              const isSelected = selected.has(inv.id)
              const age = ageInDays(inv.created_at)
              const editLog = Array.isArray(inv.edit_log) ? inv.edit_log : []
              const isModified = editLog.length > 0
              const lastEdit = isModified ? editLog[editLog.length - 1] : null

              // Age-based urgency
              let ageColor = 'var(--text-6)'
              let ageText = age !== null ? `${age}d` : '—'
              if (nStatus === 'uploaded' && !inv.assigned_to && age >= 2) ageColor = '#EF4444'
              else if (nStatus === 'uploaded' && !inv.assigned_to && age >= 1) ageColor = '#F59E0B'
              else if (nStatus === 'in_review' && age >= 3) ageColor = '#EF4444'
              else if (nStatus === 'in_review' && age >= 2) ageColor = '#F59E0B'

              const rowBackground = isSelected
                ? (isDark ? 'rgba(59,130,246,0.08)' : 'rgba(37,99,235,0.04)')
                : isModified
                  ? (isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.06)')
                  : undefined

              return (
                <tr key={inv.id}
                  className="cursor-pointer row-hover"
                  style={{
                    borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                    backgroundColor: rowBackground,
                    borderLeft: isModified ? '4px solid #F59E0B' : '4px solid transparent',
                  }}>
                  <td className="px-4 py-3" style={{ width: colWidths._select, overflow: 'hidden' }}>
                    <div onClick={(e) => toggleSelect(inv.id, e)}
                      className="w-4 h-4 rounded border flex items-center justify-center"
                      style={{
                        borderColor: isSelected ? '#3B82F6' : 'var(--border-strong)',
                        backgroundColor: isSelected ? '#3B82F6' : 'transparent',
                      }}>
                      {isSelected && <Check size={10} color="white" />}
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ width: colWidths.id, overflow: 'hidden' }} onClick={() => onSelectInvoice(inv)}>
                    <span className="font-mono text-xs font-medium" style={{ color: '#3B82F6' }}>
                      {inv.invoice_number || inv.id}
                    </span>
                    {inv.invoice_number && (
                      <div className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-7)', fontSize: '10px' }}>
                        {typeof inv.id === 'string' && inv.id.length > 10 ? inv.id.slice(0, 8) + '…' : inv.id}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ width: colWidths.vendor_name, overflow: 'hidden' }} onClick={() => onSelectInvoice(inv)}>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm" style={{ color: 'var(--text-2)' }}>{inv.vendor_name}</span>
                      {isModified && (
                        <span
                          title={`Modified by ${lastEdit.user}`}
                          className="inline-flex items-center text-xs px-1.5 py-0.5 rounded font-medium"
                          style={{ backgroundColor: 'rgba(245,158,11,0.14)', color: '#92400E', fontSize: '10px' }}
                        >
                          ✎ {lastEdit.user}
                        </span>
                      )}
                    </div>
                    {(inv.source === 'external_submission' || inv.source === 'vendor') && (
                      <span className="inline-flex items-center gap-1 text-xs mt-0.5 px-1.5 py-0.5 rounded font-medium"
                        style={{ backgroundColor: 'rgba(139,92,246,0.1)', color: '#8B5CF6', fontSize: '10px' }}>
                        Vendor Submitted
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ width: colWidths.property_name, overflow: 'hidden' }} onClick={() => onSelectInvoice(inv)}>
                    <div className="text-sm" style={{ color: 'var(--text-4)' }}>{inv.property_name || '—'}</div>
                    <div className="text-xs mt-0.5" style={{ color: inv.portfolio?.isMapped ? 'var(--text-6)' : '#92400E' }}>
                      {inv.portfolio?.isMapped ? inv.portfolio.portfolio_label : 'Needs Mapping'}
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ width: colWidths.amount, overflow: 'hidden' }} onClick={() => onSelectInvoice(inv)}>
                    <div className="font-semibold text-sm tabular-nums" style={{ color: 'var(--text-1)' }}>
                      {inv.amount != null
                        ? `$${Number(inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        : <span style={{ color: 'var(--text-7)' }}>—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ width: colWidths.status, overflow: 'hidden' }} onClick={() => onSelectInvoice(inv)}>
                    <StatusBadge status={displayStatus} />
                  </td>
                  <td className="px-4 py-3" style={{ width: colWidths.assigned_to, overflow: 'hidden' }} onClick={() => onSelectInvoice(inv)}>
                    {assignedUser ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                          style={{ backgroundColor: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontSize: '9px' }}>
                          {(assignedUser.full_name || assignedUser.email || '?')[0].toUpperCase()}
                        </div>
                        <span className="text-xs truncate" style={{ color: 'var(--text-4)' }}>
                          {assignedUser.full_name || assignedUser.email?.split('@')[0]}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-7)' }}>
                        <User size={11} /> Unassigned
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ width: colWidths._age, overflow: 'hidden' }} onClick={() => onSelectInvoice(inv)}>
                    <span className="text-xs font-medium tabular-nums" style={{ color: ageColor }}>
                      {ageText}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>

        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--text-4)' }}>
              {invoices.length === 0 || search ? activeEmptyState.title : 'No invoices match your filters.'}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-5)' }}>
              {invoices.length === 0 || search ? activeEmptyState.body : 'Try changing the assignment, type, or status filters.'}
            </p>
            {!search && invoices.length === 0 && activeEmptyState.cta && canUpload && (
              <button
                onClick={onUploadClick}
                className="inline-flex items-center gap-2 px-4 py-2 mt-4 rounded-lg text-sm font-semibold"
                style={{ backgroundColor: '#1D4ED8', color: 'white' }}
              >
                <Upload size={13} /> {activeEmptyState.cta}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
