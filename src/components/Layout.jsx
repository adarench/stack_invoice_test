import { Bell, Search, Settings, LayoutDashboard, FileText, ClipboardList, CheckCircle, CreditCard, Clock, ChevronDown, Sun, Moon } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

const navItems = [
  { id: 'dashboard',  label: 'Dashboard',   icon: LayoutDashboard },
  { id: 'invoices',   label: 'Invoices',     icon: FileText },
  { id: 'workorders', label: 'Work Orders',  icon: ClipboardList },
  { id: 'approvals',  label: 'Approvals',    icon: CheckCircle },
  { id: 'payments',   label: 'Payments',     icon: CreditCard },
  { id: 'audit',      label: 'Audit Trail',  icon: Clock },
]

export default function Layout({ children, activeView, setActiveView, invoices = [] }) {
  const { isDark, toggle } = useTheme()

  const pendingCount = invoices.filter(i => i.status === 'Awaiting Approval' || i.status === 'Flagged').length
  const flaggedCount = invoices.filter(i => i.risk_flag).length
  const isInvoiceView = activeView === 'invoice-detail' || activeView === 'invoices'

  return (
    <div
      className="flex h-screen overflow-hidden themed"
      style={{ backgroundColor: 'var(--bg)', color: 'var(--text-1)', fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* Sidebar */}
      <aside
        className="flex-shrink-0 flex flex-col themed"
        style={{ width: '240px', backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-2.5 px-5 themed"
          style={{ height: '56px', borderBottom: '1px solid var(--border)' }}
        >
          <div
            className="flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', boxShadow: '0 0 0 1px rgba(59,130,246,0.3)' }}
          >
            <span className="text-xs font-bold text-white tracking-tight">OF</span>
          </div>
          <span className="font-semibold text-sm" style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}>OpsFlow</span>
          <span
            className="ml-auto text-xs font-medium px-1.5 py-0.5 rounded"
            style={{
                backgroundColor: isDark ? '#1E3A5F' : 'rgba(37,99,235,0.1)',
                color: isDark ? '#60A5FA' : '#2563EB',
                fontSize: '10px',
              }}
          >
            BETA
          </span>
        </div>

        {/* Org selector */}
        <div className="px-3 py-2.5 themed" style={{ borderBottom: '1px solid var(--border)' }}>
          <button
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-colors item-hover"
            style={{ backgroundColor: 'var(--surface-alt)', color: 'var(--text-4)' }}
          >
            <div className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: '#1D4ED8', color: 'white', fontSize: '9px' }}>PM</div>
            <span className="truncate font-medium" style={{ color: 'var(--text-2)' }}>Premier Properties</span>
            <ChevronDown size={12} className="ml-auto flex-shrink-0" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <p className="px-3 pt-1 pb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-6)' }}>
            Operations
          </p>
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = activeView === item.id || (item.id === 'invoices' && isInvoiceView)
            const badge = item.id === 'approvals' ? pendingCount : item.id === 'invoices' ? flaggedCount : 0
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded text-sm transition-all duration-150"
                style={{
                  backgroundColor: isActive ? 'rgba(37,99,235,0.15)' : 'transparent',
                  color: isActive ? (isDark ? '#60A5FA' : '#2563EB') : 'var(--text-5)',
                  borderLeft: isActive ? '2px solid #3B82F6' : '2px solid transparent',
                  textAlign: 'left',
                }}
              >
                <Icon size={14} style={{ flexShrink: 0 }} />
                <span className="font-medium">{item.label}</span>
                {badge > 0 && (
                  <span
                    className="ml-auto text-xs font-semibold px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: item.id === 'invoices'
                          ? (isDark ? '#7F1D1D' : 'rgba(220,38,38,0.1)')
                          : (isDark ? '#1E3A5F' : 'rgba(37,99,235,0.1)'),
                      color: item.id === 'invoices'
                          ? (isDark ? '#FCA5A5' : '#DC2626')
                          : (isDark ? '#93C5FD' : '#2563EB'),
                      fontSize: '10px',
                    }}
                  >
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* User footer */}
        <div className="p-3 themed" style={{ borderTop: '1px solid var(--border)' }}>
          <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-xs item-hover transition-colors">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: 'white' }}
            >TU</div>
            <div className="flex-1 text-left min-w-0">
              <div className="font-medium truncate" style={{ color: 'var(--text-2)', fontSize: '12px' }}>Test User</div>
              <div className="truncate" style={{ color: 'var(--text-5)', fontSize: '11px' }}>Facilities Manager</div>
            </div>
            <Settings size={13} style={{ color: 'var(--text-6)', flexShrink: 0 }} />
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header
          className="flex items-center gap-4 px-6 flex-shrink-0 themed"
          style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', height: '56px' }}
        >
          {/* Search */}
          <div
            className="flex items-center gap-2 flex-1 rounded-md px-3 py-1.5 max-w-md themed"
            style={{ backgroundColor: 'var(--surface-input)', border: '1px solid var(--border-subtle)' }}
          >
            <Search size={13} style={{ color: 'var(--text-6)' }} />
            <input
              className="bg-transparent text-sm outline-none flex-1"
              placeholder="Search invoices, vendors, properties…"
              style={{ color: 'var(--text-4)', fontSize: '13px' }}
            />
            <kbd
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--border)', color: 'var(--text-6)', fontSize: '10px', fontFamily: 'monospace' }}
            >⌘K</kbd>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Status indicator */}
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ backgroundColor: '#10B981' }} />
              <span style={{ color: 'var(--text-6)', fontSize: '11px' }}>All systems operational</span>
            </div>

            {/* ── Theme toggle ─────────────────────────────────── */}
            <button
              onClick={toggle}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200"
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                color: 'var(--text-4)',
                border: '1px solid var(--border)',
              }}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark
                ? <><Sun size={13} style={{ color: '#FCD34D' }} /> <span>Light</span></>
                : <><Moon size={13} style={{ color: '#818CF8' }} /> <span>Dark</span></>
              }
            </button>

            {/* Notifications */}
            <button className="relative p-1.5 rounded transition-colors" style={{ color: 'var(--text-5)' }}>
              <Bell size={15} />
              {pendingCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center font-bold"
                  style={{ backgroundColor: '#EF4444', color: 'white', fontSize: '9px' }}
                >
                  {pendingCount}
                </span>
              )}
            </button>

            {/* User avatar */}
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: 'white' }}
              >TU</div>
              <span style={{ color: 'var(--text-4)', fontSize: '12px' }}>Test User</span>
              <ChevronDown size={12} style={{ color: 'var(--text-6)' }} />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto themed" style={{ backgroundColor: 'var(--bg)' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
