import { useState, useEffect, useCallback } from 'react'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import InvoiceList from './components/InvoiceList'
import InvoiceDetail from './components/InvoiceDetail'
import LoginScreen from './components/LoginScreen'
import VendorSubmit from './components/VendorSubmit'
import VendorDashboard from './components/VendorDashboard'
import { invoices as initialInvoices } from './data/mockData'
import { WORKFLOW_STATUSES, DEMO_USERS, normalizeWorkflowStatus, ROLE_DEFAULT_VIEW } from './data/demoUsers'
import { supabase, skipAuth } from './lib/supabaseClient'
import { fetchInvoices, updateInvoice, deleteInvoice } from './api/invoiceApi'
import { createAuditLog } from './api/auditApi'
import { sendNotification, resolveRecipients } from './api/notificationApi'
import { allocationBlockReason, normalizeGlSplits, portfolioTabsForInvoices, portfolioState, resolvePortfolio } from './lib/invoiceAccounting'

// Upsert demo users into profiles on startup (keeps names/emails in sync)
async function seedDemoUsers() {
  if (!supabase || !skipAuth) return
  try {
    const rows = DEMO_USERS.map(u => ({ id: u.id, email: u.email, full_name: u.full_name, role: u.role }))
    const { error } = await supabase.from('profiles').upsert(rows, { onConflict: 'id' })
    if (error) console.warn('[App] Demo user sync failed (run migration 004):', error.message)
  } catch (err) {
    console.warn('[App] Demo user sync error:', err.message)
  }
}

function displayStatus(dbStatus) {
  return WORKFLOW_STATUSES[normalizeWorkflowStatus(dbStatus)] || dbStatus
}

// ─── Inner app ──────────────────────────────────────────────────────────────
const UNTRACKED_EDIT_FIELDS = new Set([
  'pdfUrl', 'file_url', 'age', 'edit_log',
  'updated_at', 'created_at', 'last_action_at',
  'approved_at', 'paid_at', 'rejected_at',
])

function diffEditedFields(prev, next) {
  if (!next) return []
  return Object.keys(next).filter(key => {
    if (UNTRACKED_EDIT_FIELDS.has(key)) return false
    const before = prev?.[key]
    const after = next[key]
    if (before === after) return false
    try {
      return JSON.stringify(before) !== JSON.stringify(after)
    } catch {
      return true
    }
  })
}

function normalizeNotifications(notifications) {
  if (!notifications || typeof notifications !== 'object' || Array.isArray(notifications)) {
    return {}
  }
  return {
    ...notifications,
    reviewEmailSent: notifications.reviewEmailSent === true,
    lastNotifiedAt: typeof notifications.lastNotifiedAt === 'string' ? notifications.lastNotifiedAt : null,
    lastNotifiedUserId: typeof notifications.lastNotifiedUserId === 'string' ? notifications.lastNotifiedUserId : null,
    lastNotifiedEmail: typeof notifications.lastNotifiedEmail === 'string' ? notifications.lastNotifiedEmail : null,
    lastNotifiedName: typeof notifications.lastNotifiedName === 'string' ? notifications.lastNotifiedName : null,
  }
}

function mergeReviewNotificationState(currentInvoice, dbUpdate) {
  const currentStatus = normalizeWorkflowStatus(currentInvoice?.status)
  const nextStatus = normalizeWorkflowStatus(dbUpdate?.status || currentStatus)
  const currentNotifications = normalizeNotifications(currentInvoice?.notifications)

  if (currentStatus === 'in_review' && nextStatus !== 'in_review') {
    return {
      ...currentNotifications,
      reviewEmailSent: false,
    }
  }

  return currentNotifications
}

function buildReviewNotificationMetadata(invoice, recipient, timestamp) {
  const currentNotifications = normalizeNotifications(invoice?.notifications)
  return {
    ...currentNotifications,
    reviewEmailSent: true,
    lastNotifiedAt: timestamp,
    lastNotifiedUserId: invoice?.assigned_reviewer_id || invoice?.assigned_to || null,
    lastNotifiedEmail: recipient?.email || null,
    lastNotifiedName: recipient?.name || null,
  }
}

function shouldSendReviewNotification(invoice, action, recipients) {
  if (action !== 'submit_for_review' || !invoice) return false
  if (normalizeWorkflowStatus(invoice.status) !== 'in_review') return false
  if (!invoice.assigned_reviewer_id && !invoice.assigned_to) return false
  if (!Array.isArray(recipients) || recipients.length === 0) return false
  return !normalizeNotifications(invoice.notifications).reviewEmailSent
}

function AppShell() {
  const { user, isMockMode, role, permissions } = useAuth()
  const isVendor = role === 'vendor'
  const [activeView, setActiveView] = useState(ROLE_DEFAULT_VIEW[role] || 'dashboard')
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null)
  const [showUpload, setShowUpload] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')
  const [portfolioFilter, setPortfolioFilter] = useState('all')
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  // Reset view when role changes (user switch)
  useEffect(() => {
    setActiveView(ROLE_DEFAULT_VIEW[role] || 'dashboard')
  }, [role])

  const nowIso = () => new Date().toISOString()
  const normalizeInvoice = useCallback((invoice) => {
    if (!invoice) return invoice
    return {
      ...invoice,
      status: normalizeWorkflowStatus(invoice.status),
      gl_splits: normalizeGlSplits(invoice.gl_splits, invoice),
      notifications: normalizeNotifications(invoice.notifications),
      portfolio: portfolioState(invoice),
    }
  }, [])

  // ── Load invoices ──────────────────────────────────────────────────────────
  const loadInvoices = useCallback(async () => {
    if (isMockMode || !supabase) {
      setInvoices(initialInvoices.map(normalizeInvoice))
      setLoading(false)
      return
    }
    try {
      const data = await fetchInvoices()
      setInvoices(data.map(normalizeInvoice))
    } catch (err) {
      console.error('Failed to load invoices:', err)
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }, [isMockMode, normalizeInvoice])

  useEffect(() => {
    seedDemoUsers().then(() => loadInvoices())
  }, [loadInvoices])

  // ── Real-time subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (isMockMode || !supabase) return
    const channel = supabase
      .channel('invoices-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        loadInvoices()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [isMockMode, loadInvoices])

  // ── Workflow action handler ────────────────────────────────────────────────
  const handleInvoiceAction = useCallback(async (invoiceId, action, meta = {}) => {
    const userName = user?.full_name || user?.email?.split('@')[0] || 'User'
    const currentInvoice = invoices.find(inv => inv.id === invoiceId)
    const allocationBlock = (action === 'approve' || action === 'mark_paid')
      ? allocationBlockReason(currentInvoice?.amount, normalizeGlSplits(currentInvoice?.gl_splits, currentInvoice))
      : null

    if (allocationBlock) {
      console.warn('[App] workflow blocked by allocation mismatch:', { invoiceId, action, allocationBlock })
      return
    }

    // Build the DB update based on action
    let dbUpdate = {}
    let auditAction = action
    let auditNote = meta.note || null

    switch (action) {
      case 'submit_for_review':
        dbUpdate = {
          status: 'in_review',
          assigned_to: meta.userId || null,
          assigned_reviewer_id: meta.userId || null,
          last_action_at: nowIso(),
        }
        auditNote = auditNote || `Submitted for review${meta.userProfile ? ` → ${meta.userProfile.full_name}` : ''}`
        break
      case 'approve':
        dbUpdate = {
          status: 'approved',
          approved_by: user?.id || null,
          reviewed_by: user?.id || null,
          approved_at: nowIso(),
          last_action_at: nowIso(),
        }
        auditNote = auditNote || `Approved by ${userName}`
        break
      case 'reject':
        dbUpdate = {
          status: 'uploaded',
          assigned_to: null,
          assigned_reviewer_id: null,
          last_action_at: nowIso(),
        }
        auditNote = auditNote || `Returned by ${userName}`
        break
      case 'send_back':
        dbUpdate = {
          status: 'uploaded',
          assigned_to: null,
          assigned_reviewer_id: null,
          last_action_at: nowIso(),
        }
        auditNote = auditNote || `Sent back for clarification by ${userName}`
        break
      case 'mark_paid':
        dbUpdate = {
          status: 'paid',
          paid_by: user?.id || null,
          paid_at: nowIso(),
          last_action_at: nowIso(),
        }
        auditNote = auditNote || `Marked paid by ${userName}`
        break
      case 'assign':
        dbUpdate = {
          assigned_to: meta.userId || null,
          assigned_reviewer_id: meta.userId || null,
          last_action_at: nowIso(),
        }
        auditNote = meta.userId
          ? `Assigned to ${meta.userProfile?.full_name || meta.userId}`
          : 'Unassigned'
        break
      case 'edit': {
        const fields = meta.fields || {}
        const changedFields = diffEditedFields(currentInvoice, fields)
        if (changedFields.length > 0) {
          const entry = {
            user: userName,
            user_id: user?.id || null,
            timestamp: nowIso(),
            fields: changedFields,
          }
          const prevLog = Array.isArray(currentInvoice?.edit_log) ? currentInvoice.edit_log : []
          dbUpdate = { ...fields, edit_log: [...prevLog, entry] }
        } else {
          dbUpdate = { ...fields }
        }
        auditNote = changedFields.length > 0
          ? `Fields updated: ${changedFields.join(', ')}`
          : 'Fields updated'
        break
      }
      case 'mark_reviewed':
        dbUpdate = { edit_log: [], last_action_at: nowIso() }
        auditNote = auditNote || `Marked reviewed by ${userName}`
        break
      case 'reopen':
        dbUpdate = {
          status: 'uploaded',
          assigned_to: null,
          assigned_reviewer_id: null,
          last_action_at: nowIso(),
        }
        auditNote = auditNote || `Reopened by ${userName}`
        break
      case 'delete': {
        setInvoices(prev => prev.filter(inv => inv.id !== invoiceId))
        if (selectedInvoiceId === invoiceId) {
          setSelectedInvoiceId(null)
          setActiveView('invoices')
        }
        if (!isMockMode && supabase) {
          try {
            await deleteInvoice(invoiceId, currentInvoice?.file_url)
          } catch (err) {
            console.error('Failed to delete invoice:', err)
            loadInvoices()
          }
        }
        return
      }
      default:
        return
    }

    const nextNotifications = mergeReviewNotificationState(currentInvoice, dbUpdate)
    if (Object.keys(nextNotifications).length > 0 || currentInvoice?.notifications) {
      dbUpdate.notifications = nextNotifications
    }

    // Optimistic local update
    setInvoices(prev => prev.map(inv => {
      if (inv.id !== invoiceId) return inv
      const nextInvoice = normalizeInvoice({
        ...inv,
        ...dbUpdate,
        ...(action === 'assign' || action === 'submit_for_review'
          ? { assigned_user: meta.userProfile || null }
          : {}),
        ...(action === 'approve'
          ? {
              approver: user ? {
                id: user.id,
                full_name: user.full_name || user.user_metadata?.full_name || user.email,
                email: user.email,
                role,
              } : null,
              reviewer: user ? {
                id: user.id,
                full_name: user.full_name || user.user_metadata?.full_name || user.email,
                email: user.email,
                role,
              } : inv.reviewer,
            }
          : {}),
        ...(action === 'mark_paid'
          ? {
              payer: user ? {
                id: user.id,
                full_name: user.full_name || user.user_metadata?.full_name || user.email,
                email: user.email,
                role,
              } : null,
            }
          : {}),
      })
      return {
        ...nextInvoice,
      }
    }))

    // Persist to Supabase
    if (!isMockMode && supabase) {
      try {
        const persistedInvoice = normalizeInvoice(await updateInvoice(invoiceId, dbUpdate))
        if (user?.id && /^[0-9a-f-]{36}$/.test(user.id)) {
          await createAuditLog(invoiceId, user.id, auditAction, auditNote)
        }

        const notificationInvoice = persistedInvoice || normalizeInvoice({
          ...currentInvoice,
          ...dbUpdate,
        })
        const recipients = await resolveRecipients(action, notificationInvoice, user, meta)

        if (shouldSendReviewNotification(notificationInvoice, action, recipients)) {
          const sentAt = nowIso()
          const result = await sendNotification({
            action: 'review_pending',
            invoice: {
              id: invoiceId,
              invoice_number: notificationInvoice.invoice_number,
              vendor_name: notificationInvoice.vendor_name,
              property_name: notificationInvoice.property_name,
              amount: notificationInvoice.amount,
              vendor_email: notificationInvoice.vendor_email,
              source: notificationInvoice.source,
            },
            recipients,
            actor: { name: userName, email: user?.email },
            link: window.location.origin,
          })

          if (result?.success && result.sent > 0) {
            const notificationMetadata = buildReviewNotificationMetadata(notificationInvoice, recipients[0], sentAt)
            const notificationUpdate = await updateInvoice(invoiceId, { notifications: notificationMetadata })
            setInvoices(prev => prev.map(inv => (
              inv.id === invoiceId
                ? normalizeInvoice({ ...inv, notifications: notificationUpdate.notifications })
                : inv
            )))
          } else {
            console.warn('[App] review notification failed or was skipped:', { invoiceId, result })
          }
        } else if (recipients.length > 0) {
          sendNotification({
            action,
            invoice: {
              id: invoiceId,
              invoice_number: notificationInvoice.invoice_number,
              vendor_name: notificationInvoice.vendor_name,
              property_name: notificationInvoice.property_name,
              amount: notificationInvoice.amount,
              vendor_email: notificationInvoice.vendor_email,
              source: notificationInvoice.source,
            },
            recipients,
            actor: { name: userName, email: user?.email },
          })
        }
      } catch (err) {
        console.error('Failed to persist action:', err)
        loadInvoices()
      }
    }
  }, [user, role, isMockMode, loadInvoices, normalizeInvoice, invoices])

  const handleSelectInvoice = useCallback((invoice) => {
    setSelectedInvoiceId(invoice.id)
    setActiveView('invoice-detail')
  }, [])

  const handleGlobalSearchChange = useCallback((value) => {
    setGlobalSearch(value)
    if (value.trim() && !isVendor) {
      setActiveView('invoices')
    }
  }, [isVendor])

  const handleUploaded = useCallback((newInvoice) => {
    const normalizedInvoice = normalizeInvoice(newInvoice)
    setInvoices(prev => [normalizedInvoice, ...prev])
    handleSelectInvoice(normalizedInvoice)
  }, [handleSelectInvoice, normalizeInvoice])

  const selectedInvoice = invoices.find(i => i.id === selectedInvoiceId)
  const portfolioTabs = portfolioTabsForInvoices(invoices)
  const portfolioFilteredInvoices = portfolioFilter === 'all'
    ? invoices
    : invoices.filter(invoice => invoice.portfolio?.portfolio_key === portfolioFilter)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="text-center space-y-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto"
            style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}>
            <span className="text-xs font-bold text-white">OF</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-5)' }}>Loading invoices…</p>
        </div>
      </div>
    )
  }

  // Queue filters for different views
  const queueFilter = (view) => {
    switch (view) {
      case 'my-queue':
        return invoices.filter(i =>
          (portfolioFilter === 'all' || i.portfolio?.portfolio_key === portfolioFilter) && (
          i.assigned_to === user?.id ||
          i.uploaded_by === user?.id
          ))
      case 'review':
        return invoices.filter(i =>
          (portfolioFilter === 'all' || i.portfolio?.portfolio_key === portfolioFilter) &&
          i.status === 'in_review'
        )
      case 'accounting':
        return invoices.filter(i =>
          (portfolioFilter === 'all' || i.portfolio?.portfolio_key === portfolioFilter) &&
          i.status === 'approved'
        )
      case 'paid':
        return invoices.filter(i =>
          (portfolioFilter === 'all' || i.portfolio?.portfolio_key === portfolioFilter) &&
          i.status === 'paid'
        )
      default:
        return portfolioFilteredInvoices
    }
  }

  return (
    <Layout
      activeView={activeView}
      setActiveView={setActiveView}
      invoices={portfolioFilteredInvoices}
      globalSearch={globalSearch}
      onGlobalSearchChange={handleGlobalSearchChange}
      onUploadComplete={handleUploaded}
      showUpload={showUpload}
      onOpenUpload={() => setShowUpload(true)}
      onCloseUpload={() => setShowUpload(false)}
      onAction={handleInvoiceAction}
    >
      {activeView === 'dashboard' && (
        <Dashboard
          invoices={portfolioFilteredInvoices}
          onSelectInvoice={handleSelectInvoice}
          setActiveView={setActiveView}
          onAction={handleInvoiceAction}
          portfolioTabs={portfolioTabs}
          portfolioFilter={portfolioFilter}
          onPortfolioChange={setPortfolioFilter}
        />
      )}
      {activeView === 'invoices' && (
        <InvoiceList
          invoices={portfolioFilteredInvoices}
          queueMode="all"
          title="All Invoices"
          onSelectInvoice={handleSelectInvoice}
          onUploadClick={() => setShowUpload(true)}
          onAction={handleInvoiceAction}
          searchQuery={globalSearch}
          onSearchChange={setGlobalSearch}
          portfolioTabs={portfolioTabs}
          portfolioFilter={portfolioFilter}
          onPortfolioChange={setPortfolioFilter}
        />
      )}
      {activeView === 'my-queue' && (
        <InvoiceList
          invoices={queueFilter('my-queue')}
          queueMode="my-queue"
          title="My Queue"
          onSelectInvoice={handleSelectInvoice}
          onUploadClick={() => setShowUpload(true)}
          onAction={handleInvoiceAction}
          searchQuery={globalSearch}
          onSearchChange={setGlobalSearch}
          portfolioTabs={portfolioTabs}
          portfolioFilter={portfolioFilter}
          onPortfolioChange={setPortfolioFilter}
        />
      )}
      {activeView === 'review' && (
        <InvoiceList
          invoices={queueFilter('review')}
          queueMode="review"
          title="In Review"
          onSelectInvoice={handleSelectInvoice}
          onUploadClick={() => setShowUpload(true)}
          onAction={handleInvoiceAction}
          searchQuery={globalSearch}
          onSearchChange={setGlobalSearch}
          portfolioTabs={portfolioTabs}
          portfolioFilter={portfolioFilter}
          onPortfolioChange={setPortfolioFilter}
        />
      )}
      {activeView === 'accounting' && (
        <InvoiceList
          invoices={queueFilter('accounting')}
          queueMode="accounting"
          title="Approved"
          onSelectInvoice={handleSelectInvoice}
          onUploadClick={() => setShowUpload(true)}
          onAction={handleInvoiceAction}
          searchQuery={globalSearch}
          onSearchChange={setGlobalSearch}
          portfolioTabs={portfolioTabs}
          portfolioFilter={portfolioFilter}
          onPortfolioChange={setPortfolioFilter}
        />
      )}
      {activeView === 'paid' && (
        <InvoiceList
          invoices={queueFilter('paid')}
          queueMode="paid"
          title="Paid Invoices"
          onSelectInvoice={handleSelectInvoice}
          onUploadClick={() => setShowUpload(true)}
          onAction={handleInvoiceAction}
          searchQuery={globalSearch}
          onSearchChange={setGlobalSearch}
          portfolioTabs={portfolioTabs}
          portfolioFilter={portfolioFilter}
          onPortfolioChange={setPortfolioFilter}
        />
      )}
      {activeView === 'modified' && (
        <InvoiceList
          invoices={portfolioFilteredInvoices.filter(i => Array.isArray(i.edit_log) && i.edit_log.length > 0)}
          queueMode="all"
          title="Modified Invoices"
          onSelectInvoice={handleSelectInvoice}
          onUploadClick={() => setShowUpload(true)}
          onAction={handleInvoiceAction}
          searchQuery={globalSearch}
          onSearchChange={setGlobalSearch}
          portfolioTabs={portfolioTabs}
          portfolioFilter={portfolioFilter}
          onPortfolioChange={setPortfolioFilter}
        />
      )}
      {activeView === 'invoice-detail' && selectedInvoice && (
        <InvoiceDetail
          invoice={selectedInvoice}
          onAction={handleInvoiceAction}
          onBack={() => setActiveView('invoices')}
        />
      )}
      {activeView === 'vendor-submit' && (
        <VendorSubmit
          onSubmitted={(invoice) => {
            if (invoice) setInvoices(prev => [normalizeInvoice(invoice), ...prev])
            setActiveView('invoices')
          }}
        />
      )}
      {activeView === 'vendor-dashboard' && (
        <VendorDashboard
          invoices={invoices}
          onSubmitted={(invoice) => {
            if (invoice) setInvoices(prev => [normalizeInvoice(invoice), ...prev])
          }}
        />
      )}
    </Layout>
  )
}

// ─── Auth gate ──────────────────────────────────────────────────────────────
function AuthGate() {
  const { user, loading, isConfigured, isDemoMode, isExplicitMockMode, missingConfigMessage } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="w-6 h-6 rounded border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!isConfigured && !isDemoMode && !isExplicitMockMode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="w-full max-w-lg rounded-2xl p-8"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}>
              <span className="text-sm font-bold text-white">OF</span>
            </div>
            <div>
              <div className="font-semibold" style={{ color: 'var(--text-1)' }}>OpsFlow Setup Required</div>
              <div className="text-sm" style={{ color: 'var(--text-5)' }}>Hosted demo configuration is incomplete.</div>
            </div>
          </div>
          <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-4)' }}>
            {missingConfigMessage}
          </p>
          <div className="text-xs font-mono rounded-lg p-3"
            style={{ backgroundColor: 'var(--surface-alt)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
            VITE_SUPABASE_URL
            <br />
            VITE_SUPABASE_ANON_KEY
            <br />
            VITE_SKIP_AUTH=false
          </div>
        </div>
      </div>
    )
  }

  if (!user) return <LoginScreen />
  return <AppShell />
}

// ─── Root ───────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </ThemeProvider>
  )
}
