import { useState } from 'react'
import { Search, Filter, Upload, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { useTheme } from '../context/ThemeContext'

export default function InvoiceList({ invoices, onSelectInvoice }) {
  const { isDark } = useTheme()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sortCol, setSortCol] = useState('invoice_date')
  const [sortDir, setSortDir] = useState('desc')

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const filtered = invoices
    .filter(inv => {
      const q = search.toLowerCase()
      if (q && !inv.vendor_name.toLowerCase().includes(q) &&
              !inv.property_name.toLowerCase().includes(q) &&
              !inv.id.toLowerCase().includes(q)) return false
      if (typeFilter !== 'All' && inv.invoice_type !== typeFilter) return false
      if (statusFilter !== 'All' && inv.status !== statusFilter) return false
      return true
    })
    .sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol]
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  const cols = [
    { key: 'id',           label: 'Invoice ID', sortable: true },
    { key: 'vendor_name',  label: 'Vendor',     sortable: true },
    { key: 'property_name',label: 'Property',   sortable: true },
    { key: 'amount',       label: 'Amount',     sortable: true },
    { key: 'invoice_type', label: 'Type',       sortable: true },
    { key: 'gl_code',      label: 'GL Code',    sortable: false },
    { key: 'status',       label: 'Status',     sortable: true },
    { key: 'risk',         label: 'Risk',       sortable: false },
  ]

  const statuses = ['All', ...Array.from(new Set(invoices.map(i => i.status)))]
  const types = ['All', 'Work Order', 'Contract', 'Utility']

  return (
    <div className="p-6 fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            Invoices
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-5)' }}>
            {invoices.length} total · {invoices.filter(i => i.risk_flag).length} flagged
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium"
          style={{ backgroundColor: '#1D4ED8', color: 'white' }}
        >
          <Upload size={13} />
          Upload Invoice
        </button>
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
            {filtered.map((inv, i) => (
              <tr key={inv.id} onClick={() => onSelectInvoice(inv)}
                className="cursor-pointer row-hover"
                style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs font-medium" style={{ color: '#3B82F6' }}>{inv.id}</span>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-6)' }}>{inv.invoice_date}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-sm" style={{ color: 'var(--text-2)' }}>{inv.vendor_name}</div>
                  <div className="text-xs" style={{ color: 'var(--text-5)' }}>{inv.invoice_number}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm" style={{ color: 'var(--text-4)' }}>{inv.property_name}</div>
                  <div className="text-xs" style={{ color: 'var(--text-6)' }}>{inv.building}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-sm tabular-nums" style={{ color: 'var(--text-1)' }}>
                    ${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-6)' }}>Due {inv.due_date}</div>
                </td>
                <td className="px-4 py-3">
                  <TypeBadge type={inv.invoice_type} isDark={isDark} />
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-mono" style={{ color: 'var(--text-5)' }}>
                    {inv.gl_code.split('—')[0].trim()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={inv.status} />
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
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm" style={{ color: 'var(--text-5)' }}>No invoices match your filters</p>
          </div>
        )}
      </div>
    </div>
  )
}

function TypeBadge({ type, isDark }) {
  const colors = isDark
    ? {
        'Work Order': { bg: 'rgba(59,130,246,0.12)',  color: '#93C5FD', border: 'rgba(59,130,246,0.25)' },
        'Contract':   { bg: 'rgba(139,92,246,0.12)',  color: '#C4B5FD', border: 'rgba(139,92,246,0.25)' },
        'Utility':    { bg: 'rgba(107,114,128,0.12)', color: '#9CA3AF', border: 'rgba(107,114,128,0.25)' },
      }
    : {
        'Work Order': { bg: 'rgba(37,99,235,0.1)',    color: '#1D4ED8', border: 'rgba(37,99,235,0.25)' },
        'Contract':   { bg: 'rgba(109,40,217,0.1)',   color: '#5B21B6', border: 'rgba(109,40,217,0.25)' },
        'Utility':    { bg: 'rgba(100,116,139,0.1)',  color: '#475569', border: 'rgba(100,116,139,0.25)' },
      }
  const c = colors[type] || colors['Utility']
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {type}
    </span>
  )
}
