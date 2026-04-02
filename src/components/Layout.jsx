import { useState } from 'react'
import {
  Bell, Search, Settings, FileText, CheckCircle, DollarSign,
  ChevronDown, Sun, Moon, Upload, LogOut, Inbox, ListChecks, CheckCircle2,
  Users, ChevronUp, ExternalLink
} from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABELS } from '../data/demoUsers'
import UploadInvoice from './UploadInvoice'
import ActionRequiredBanner from './ActionRequiredBanner'

export default function Layout({ children, activeView, setActiveView, invoices = [], onUploadComplete }) {
  const { isDark, toggle } = useTheme()
  const {
    displayName, initials, signOut, isMockMode, isDemoMode,
    user, role, permissions, demoUsers, switchUser,
  } = useAuth()
  const [showUpload, setShowUpload] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showUserSwitcher, setShowUserSwitcher] = useState(false)

  const reviewCount = invoices.filter(i =>
    i.status === 'in_review'
  ).length
  const accountingCount = invoices.filter(i => i.status === 'approved').length
  const paidCount = invoices.filter(i => i.status === 'paid').length
  const myCount = invoices.filter(i =>
    i.assigned_to === user?.id || i.uploaded_by === user?.id
  ).length

  const vendorCount = invoices.filter(i => i.source === 'external_submission').length

  const navItems = [
    { id: 'invoices',   label: 'All Invoices', icon: FileText,    badge: 0 },
    { id: 'my-queue',   label: 'My Queue',     icon: Inbox,       badge: myCount },
    { id: 'review',     label: 'In Review',      icon: ListChecks,  badge: reviewCount },
    { id: 'accounting', label: 'Approved',      icon: DollarSign,  badge: accountingCount },
    { id: 'paid',       label: 'Paid',          icon: CheckCircle2, badge: paidCount },
  ]

  const handleSignOut = async () => {
    setShowUserMenu(false)
    await signOut()
  }

  const isVendor = role === 'vendor'

  // Color by role
  const roleColors = {
    uploader: { bg: '#1D4ED8', gradient: 'linear-gradient(135deg, #3B82F6, #2563EB)' },
    reviewer: { bg: '#059669', gradient: 'linear-gradient(135deg, #10B981, #059669)' },
    accounting: { bg: '#7C3AED', gradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' },
    admin: { bg: '#DC2626', gradient: 'linear-gradient(135deg, #EF4444, #DC2626)' },
    vendor: { bg: '#D97706', gradient: 'linear-gradient(135deg, #F59E0B, #D97706)' },
  }
  const rc = roleColors[role] || roleColors.uploader

  return (
    <div
      className="flex h-screen overflow-hidden themed"
      style={{ backgroundColor: 'var(--bg)', color: 'var(--text-1)', fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className="flex-shrink-0 flex flex-col themed"
        style={{ width: '240px', backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 themed" style={{ height: '56px', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', boxShadow: '0 0 0 1px rgba(59,130,246,0.3)' }}>
            <span className="text-xs font-bold text-white tracking-tight">OF</span>
          </div>
          <span className="font-semibold text-sm" style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}>OpsFlow</span>
          <span className="ml-auto text-xs font-medium px-1.5 py-0.5 rounded"
            style={{ backgroundColor: isDark ? '#1E3A5F' : 'rgba(37,99,235,0.1)', color: isDark ? '#60A5FA' : '#2563EB', fontSize: '10px' }}>
            {isDemoMode ? 'DEMO' : isMockMode ? 'MOCK' : 'LIVE'}
          </span>
        </div>

        {/* Org selector */}
        <div className="px-3 py-2.5 themed" style={{ borderBottom: '1px solid var(--border)' }}>
          <button className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-colors item-hover"
            style={{ backgroundColor: 'var(--surface-alt)', color: 'var(--text-4)' }}>
            <div className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: isVendor ? '#D97706' : '#1D4ED8', color: 'white', fontSize: '9px' }}>
              {isVendor ? 'VP' : 'SR'}
            </div>
            <span className="truncate font-medium" style={{ color: 'var(--text-2)' }}>
              {isVendor ? 'Vendor Portal' : 'Stack Real Estate'}
            </span>
            {!isVendor && <ChevronDown size={12} className="ml-auto flex-shrink-0" />}
          </button>
        </div>

        {/* Upload CTA — internal roles only */}
        {!isVendor && permissions.canUpload && (
          <div className="px-3 pt-3 pb-1">
            <button onClick={() => setShowUpload(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-all"
              style={{
                backgroundColor: isDark ? 'rgba(37,99,235,0.2)' : 'rgba(37,99,235,0.1)',
                color: isDark ? '#60A5FA' : '#1D4ED8',
                border: isDark ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(37,99,235,0.25)',
              }}>
              <Upload size={12} />
              Upload Invoice
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {isVendor ? (
            /* ── Vendor nav ──────────────────────────────────────────── */
            <>
              <p className="px-3 pt-1 pb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-6)' }}>
                Vendor Portal
              </p>
              <button
                onClick={() => setActiveView('vendor-dashboard')}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded text-sm transition-all duration-150"
                style={{
                  backgroundColor: activeView === 'vendor-dashboard' ? 'rgba(37,99,235,0.15)' : 'transparent',
                  color: activeView === 'vendor-dashboard' ? (isDark ? '#60A5FA' : '#2563EB') : 'var(--text-5)',
                  borderLeft: activeView === 'vendor-dashboard' ? '2px solid #3B82F6' : '2px solid transparent',
                  textAlign: 'left',
                }}>
                <FileText size={14} style={{ flexShrink: 0 }} />
                <span className="font-medium">My Invoices</span>
              </button>
            </>
          ) : (
            /* ── Internal nav ────────────────────────────────────────── */
            <>
              <p className="px-3 pt-1 pb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-6)' }}>
                Workflow
              </p>
              {navItems.map(item => {
                const Icon = item.icon
                const isActive = activeView === item.id || (item.id === 'invoices' && activeView === 'invoice-detail')
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
                    }}>
                    <Icon size={14} style={{ flexShrink: 0 }} />
                    <span className="font-medium">{item.label}</span>
                    {item.badge > 0 && (
                      <span className="ml-auto text-xs font-semibold px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: isDark ? '#1E3A5F' : 'rgba(37,99,235,0.1)',
                          color: isDark ? '#93C5FD' : '#2563EB',
                          fontSize: '10px',
                        }}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                )
              })}

              <div className="my-2" style={{ borderTop: '1px solid var(--border)' }} />
              <p className="px-3 pt-1 pb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-6)' }}>
                External
              </p>
              <button
                onClick={() => setActiveView('vendor-submit')}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded text-sm transition-all duration-150"
                style={{
                  backgroundColor: activeView === 'vendor-submit' ? 'rgba(37,99,235,0.15)' : 'transparent',
                  color: activeView === 'vendor-submit' ? (isDark ? '#60A5FA' : '#2563EB') : 'var(--text-5)',
                  borderLeft: activeView === 'vendor-submit' ? '2px solid #3B82F6' : '2px solid transparent',
                  textAlign: 'left',
                }}>
                <ExternalLink size={14} style={{ flexShrink: 0 }} />
                <span className="font-medium">Vendor Submit</span>
                {vendorCount > 0 && (
                  <span className="ml-auto text-xs font-semibold px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: isDark ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.1)',
                      color: isDark ? '#C4B5FD' : '#7C3AED',
                      fontSize: '10px',
                    }}>
                    {vendorCount}
                  </span>
                )}
              </button>
            </>
          )}
        </nav>

        {/* ── User Switcher (demo mode) ─────────────────────────────────────── */}
        {isDemoMode && (
          <div className="px-3 pb-1 themed" style={{ borderTop: '1px solid var(--border)' }}>
            <button
              onClick={() => setShowUserSwitcher(v => !v)}
              className="w-full flex items-center gap-2 px-2.5 py-2 mt-2 rounded text-xs transition-colors item-hover"
              style={{ backgroundColor: 'var(--surface-alt)' }}>
              <Users size={12} style={{ color: 'var(--text-5)', flexShrink: 0 }} />
              <span className="font-medium" style={{ color: 'var(--text-3)' }}>Switch User</span>
              {showUserSwitcher
                ? <ChevronUp size={12} className="ml-auto" style={{ color: 'var(--text-6)' }} />
                : <ChevronDown size={12} className="ml-auto" style={{ color: 'var(--text-6)' }} />
              }
            </button>
            {showUserSwitcher && (
              <div className="mt-1 mb-2 rounded-lg overflow-hidden"
                style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
                {demoUsers.map(u => {
                  const isActive = user?.id === u.id
                  const urc = roleColors[u.role] || roleColors.uploader
                  return (
                    <button
                      key={u.id}
                      onClick={() => { switchUser(u.id); setShowUserSwitcher(false) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors item-hover"
                      style={{
                        backgroundColor: isActive ? 'rgba(37,99,235,0.08)' : 'transparent',
                        borderLeft: isActive ? '2px solid #3B82F6' : '2px solid transparent',
                      }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: urc.gradient, color: 'white', fontSize: '9px' }}>
                        {u.full_name.split(' ').map(p => p[0]).join('').toUpperCase()}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="font-medium truncate" style={{ color: isActive ? '#3B82F6' : 'var(--text-2)' }}>
                          {u.full_name}
                        </div>
                        <div className="truncate" style={{ color: 'var(--text-6)', fontSize: '10px' }}>
                          {ROLE_LABELS[u.role]}
                        </div>
                      </div>
                      {isActive && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#3B82F6' }} />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Current user footer */}
        <div className="p-3 themed" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(v => !v)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-xs item-hover transition-colors">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: rc.gradient, color: 'white' }}>
                {initials()}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="font-medium truncate" style={{ color: 'var(--text-2)', fontSize: '12px' }}>{displayName()}</div>
                <div className="truncate" style={{ color: 'var(--text-5)', fontSize: '11px' }}>
                  {ROLE_LABELS[role] || role}
                </div>
              </div>
              <Settings size={13} style={{ color: 'var(--text-6)', flexShrink: 0 }} />
            </button>

            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg overflow-hidden"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 50 }}>
                <button onClick={toggle}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors item-hover"
                  style={{ color: 'var(--text-4)', borderBottom: '1px solid var(--border)' }}>
                  {isDark ? <Sun size={12} style={{ color: '#FCD34D' }} /> : <Moon size={12} style={{ color: '#818CF8' }} />}
                  {isDark ? 'Light mode' : 'Dark mode'}
                </button>
                <button onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors item-hover"
                  style={{ color: isDark ? '#FCA5A5' : '#DC2626' }}>
                  <LogOut size={12} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-4 px-6 flex-shrink-0 themed"
          style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', height: '56px' }}>
          <div className="flex items-center gap-2 flex-1 rounded-md px-3 py-1.5 max-w-md themed"
            style={{ backgroundColor: 'var(--surface-input)', border: '1px solid var(--border-subtle)' }}>
            <Search size={13} style={{ color: 'var(--text-6)' }} />
            <input className="bg-transparent text-sm outline-none flex-1"
              placeholder={isVendor ? "Search your invoices…" : "Search invoices, vendors, properties…"}
              style={{ color: 'var(--text-4)', fontSize: '13px' }} />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ backgroundColor: '#10B981' }} />
              <span style={{ color: 'var(--text-6)', fontSize: '11px' }}>
                {isDemoMode ? 'Demo' : isMockMode ? 'Mock' : 'Live'}
              </span>
            </div>

            {!isVendor && permissions.canUpload && (
              <button onClick={() => setShowUpload(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                style={{ backgroundColor: '#1D4ED8', color: 'white' }}>
                <Upload size={13} /> Upload
              </button>
            )}

            {!isVendor && (
              <button className="relative p-1.5 rounded transition-colors" style={{ color: 'var(--text-5)' }}>
                <Bell size={15} />
                {reviewCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center font-bold"
                    style={{ backgroundColor: '#EF4444', color: 'white', fontSize: '9px' }}>
                    {reviewCount}
                  </span>
                )}
              </button>
            )}

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: rc.gradient, color: 'white' }}>
                {initials()}
              </div>
              <div>
                <div style={{ color: 'var(--text-3)', fontSize: '12px', fontWeight: 500 }}>{displayName()}</div>
                <div style={{ color: 'var(--text-6)', fontSize: '10px' }}>{ROLE_LABELS[role]}</div>
              </div>
            </div>
          </div>
        </header>

        <ActionRequiredBanner invoices={invoices} user={user} role={role} setActiveView={setActiveView} />

        <main className="flex-1 overflow-auto themed" style={{ backgroundColor: 'var(--bg)' }}
          onClick={() => { showUserMenu && setShowUserMenu(false) }}>
          {children}
        </main>
      </div>

      {showUpload && (
        <UploadInvoice
          onClose={() => setShowUpload(false)}
          onUploaded={(invoice) => { setShowUpload(false); onUploadComplete?.(invoice) }}
        />
      )}
    </div>
  )
}
