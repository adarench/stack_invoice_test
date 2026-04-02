import { useState } from 'react'
import { Search, Filter, Upload, ChevronDown, ChevronUp, AlertTriangle, User } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { WORKFLOW_STATUSES, normalizeWorkflowStatus } from '../data/demoUsers'

function normalizeStatus(status) {
  return WORKFLOW_STATUSES[normalizeWorkflowStatus(status)] || status
}

export default function InvoiceList({ invoices, onSelectInvoice, onUploadClick, title = 'Invoices', queueMode = 'all' }) {
  const { isDark } = useTheme()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [assignmentFilter, setAssignmentFilter] = useState('All') // All | Mine | Unassigned | In Review
  const [typeFilter, setTypeFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sortCol, setSortCol] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const assignmentTabs = [
    { key: 'All', label: 'All' },
    { key: 'Mine', label: 'Assigned to me' },
    { key: 'Unassigned', label: 'Unassigned' },
    { key: 'In Review', label: 'In Review' },
  ]

  const filtered = invoices
    .filter(inv => {
      const q = search.toLowerCase()
      if (q) {
        const searchable = [inv.vendor_name, inv.property_name, inv.id, inv.invoice_number]
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
      // Map created_at to invoice_date for mock data
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

  const cols = [
    { key: 'id',             label: 'Invoice',    sortable: true },
    { key: 'vendor_name',    label: 'Vendor',     sortable: true },
    { key: 'property_name',  label: 'Property',   sortable: true },
    { key: 'amount',         label: 'Amount',     sortable: true },
    { key: 'status',         label: 'Status',     sortable: true },
    { key: 'assigned_to',    label: 'Assigned',   sortable: false },
    { key: 'created_at',     label: 'Date',       sortable: true },
    { key: 'risk',           label: 'Risk',       sortable: false },
  ]

  const statuses = ['All', ...Array.from(new Set(invoices.map(i => normalizeStatus(i.status))))]
  const types = ['All', 'Work Order', 'Contract', 'Utility']

  return (
    <div className="p-6 fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            {title}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-5)' }}>
            {invoices.length} total
            {invoices.filter(i => i.risk_flag).length > 0 &&
              ` · ${invoices.filter(i => i.risk_flag).length} flagged`}
          </p>
        </div>
        <button
          onClick={onUploadClick}
          className="flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors"
          style={{ backgroundColor: '#1D4ED8', color: 'white' }}
        >
          <Upload size={13} />
          Upload Invoice
        </button>
      </div>

      {/* Assignment filter tabs */}
      <div className="flex gap-1 mb-3">
        {assignmentTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setAssignmentFilter(tab.key)}
            className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
            style={{
              backgroundColor: assignmentFilter === tab.key
                ? (isDark ? 'rgba(59,130,246,0.2)' : 'rgba(37,99,235,0.12)')
                : 'transparent',
              color: assignmentFilter === tab.key ? '#3B82F6' : 'var(--text-5)',
              border: assignmentFilter === tab.key ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 p-3 rounded-lg themed"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Search size={13} style={{ color: 'var(--text-6)' }} />
          <input
            className="bg-transparent text-sm outline-none flex-1"
            placeholder="Search vendor, property, invoice ID…"
            style={{ color: 'var(--text-2)', fontSize: '13px' }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
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
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-alt)' }}>
              {cols.map(col => (
                <th key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider select-none"
                  style={{
                    color: sortCol === col.key ? '#3B82F6' : 'var(--text-6)',
                    cursor: col.sortable ? 'pointer' : 'default',
                  }}>
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortCol === col.key && (
                      sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv, i) => {
              const assignedUser = inv.assigned_user
              const displayStatus = normalizeStatus(inv.status)
              const dateStr = inv.created_at
                ? new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : inv.invoice_date || '—'

              return (
                <tr key={inv.id} onClick={() => onSelectInvoice(inv)}
                  className="cursor-pointer row-hover"
                  style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-medium" style={{ color: '#3B82F6' }}>
                      {inv.invoice_number || inv.id}
                    </span>
                    {inv.invoice_number && (
                      <div className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-7)', fontSize: '10px' }}>
                        {typeof inv.id === 'string' && inv.id.length > 10 ? inv.id.slice(0, 8) + '…' : inv.id}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm" style={{ color: 'var(--text-2)' }}>{inv.vendor_name}</div>
                    {(inv.source === 'external_submission' || inv.source === 'vendor') && (
                      <span className="inline-flex items-center gap-1 text-xs mt-0.5 px-1.5 py-0.5 rounded font-medium"
                        style={{ backgroundColor: 'rgba(139,92,246,0.1)', color: '#8B5CF6', fontSize: '10px' }}>
                        Vendor Submitted
                      </span>
                    )}
                    {inv.source === 'upload' && (
                      <span className="inline-flex items-center gap-1 text-xs mt-0.5 px-1.5 py-0.5 rounded font-medium"
                        style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: '#3B82F6', fontSize: '10px' }}>
                        Internal
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm" style={{ color: 'var(--text-4)' }}>{inv.property_name || '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-sm tabular-nums" style={{ color: 'var(--text-1)' }}>
                      {inv.amount != null
                        ? `$${Number(inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        : <span style={{ color: 'var(--text-7)' }}>—</span>
                      }
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={displayStatus} />
                  </td>
                  <td className="px-4 py-3">
                    {assignedUser ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                          style={{ backgroundColor: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontSize: '9px' }}>
                          {(assignedUser.full_name || assignedUser.email || '?')[0].toUpperCase()}
                        </div>
                        <span className="text-xs" style={{ color: 'var(--text-4)' }}>
                          {assignedUser.full_name || assignedUser.email?.split('@')[0]}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-7)' }}>
                        <User size={11} /> Unassigned
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs" style={{ color: 'var(--text-5)' }}>{dateStr}</div>
                  </td>
                  <td className="px-4 py-3">
                    {inv.risk_flag ? (
                      <span className="flex items-center gap-1 text-xs" style={{ color: '#EF4444' }}>
                        <AlertTriangle size={11} />
                        {inv.risk_flag === 'anomaly' ? 'Anomaly' : 'Flagged'}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-7)' }}>—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-sm" style={{ color: 'var(--text-5)' }}>
              {invoices.length === 0 ? 'No invoices yet — upload the first one.' : 'No invoices match your filters.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
