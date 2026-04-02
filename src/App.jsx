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
import { WORKFLOW_STATUSES, DEMO_USERS, normalizeWorkflowStatus } from './data/demoUsers'
import { supabase, skipAuth } from './lib/supabaseClient'
import { fetchInvoices, updateInvoice } from './api/invoiceApi'
import { createAuditLog } from './api/auditApi'
import { sendNotification, resolveRecipients } from './api/notificationApi'

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
function AppShell() {
  const { user, isMockMode, role } = useAuth()
  const isVendor = role === 'vendor'
  const [activeView, setActiveView] = useState(isVendor ? 'vendor-dashboard' : 'invoices')
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  // Reset view when role changes (user switch)
  useEffect(() => {
    setActiveView(role === 'vendor' ? 'vendor-dashboard' : 'invoices')
  }, [role])

  const nowIso = () => new Date().toISOString()
  const normalizeInvoice = useCallback((invoice) => {
    if (!invoice) return invoice
    return {
      ...invoice,
      status: normalizeWorkflowStatus(invoice.status),
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
      case 'edit':
        dbUpdate = meta.fields || {}
        auditNote = 'Fields updated'
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
      default:
        return
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
        await updateInvoice(invoiceId, dbUpdate)
        if (user?.id && /^[0-9a-f-]{36}$/.test(user.id)) {
          await createAuditLog(invoiceId, user.id, auditAction, auditNote)
        }
        // Fire-and-forget email notification
        const inv = invoices.find(i => i.id === invoiceId)
        if (inv) {
          const recipients = resolveRecipients(action, inv, user, meta)
          sendNotification({
            action,
            invoice: {
              id: invoiceId,
              invoice_number: inv.invoice_number,
              vendor_name: inv.vendor_name,
              property_name: inv.property_name,
              amount: inv.amount,
              vendor_email: inv.vendor_email,
              source: inv.source,
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
  }, [user, role, isMockMode, loadInvoices, normalizeInvoice])

  const handleSelectInvoice = useCallback((invoice) => {
    setSelectedInvoiceId(invoice.id)
    setActiveView('invoice-detail')
  }, [])

  const handleUploaded = useCallback((newInvoice) => {
    setInvoices(prev => [newInvoice, ...prev])
    handleSelectInvoice(newInvoice)
  }, [handleSelectInvoice])

  const selectedInvoice = invoices.find(i => i.id === selectedInvoiceId)

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
          i.assigned_to === user?.id ||
          i.uploaded_by === user?.id
        )
      case 'review':
        return invoices.filter(i =>
          i.status === 'in_review'
        )
      case 'accounting':
        return invoices.filter(i => i.status === 'approved')
      case 'paid':
        return invoices.filter(i => i.status === 'paid')
      default:
        return invoices
    }
  }

  return (
    <Layout
      activeView={activeView}
      setActiveView={setActiveView}
      invoices={invoices}
      onUploadComplete={handleUploaded}
    >
      {activeView === 'dashboard' && (
        <Dashboard
          invoices={invoices}
          onSelectInvoice={handleSelectInvoice}
          setActiveView={setActiveView}
        />
      )}
      {activeView === 'invoices' && (
        <InvoiceList
          invoices={invoices}
          queueMode="all"
          title="All Invoices"
          onSelectInvoice={handleSelectInvoice}
          onUploadClick={() => {}}
        />
      )}
      {activeView === 'my-queue' && (
        <InvoiceList
          invoices={queueFilter('my-queue')}
          queueMode="my-queue"
          title="My Queue"
          onSelectInvoice={handleSelectInvoice}
          onUploadClick={() => {}}
        />
      )}
      {activeView === 'review' && (
        <InvoiceList
          invoices={queueFilter('review')}
          queueMode="review"
          title="In Review"
          onSelectInvoice={handleSelectInvoice}
          onUploadClick={() => {}}
        />
      )}
      {activeView === 'accounting' && (
        <InvoiceList
          invoices={queueFilter('accounting')}
          queueMode="accounting"
          title="Approved"
          onSelectInvoice={handleSelectInvoice}
          onUploadClick={() => {}}
        />
      )}
      {activeView === 'paid' && (
        <InvoiceList
          invoices={queueFilter('paid')}
          queueMode="paid"
          title="Paid Invoices"
          onSelectInvoice={handleSelectInvoice}
          onUploadClick={() => {}}
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
            if (invoice) setInvoices(prev => [invoice, ...prev])
            setActiveView('invoices')
          }}
        />
      )}
      {activeView === 'vendor-dashboard' && (
        <VendorDashboard
          invoices={invoices}
          onSubmitted={(invoice) => {
            if (invoice) setInvoices(prev => [invoice, ...prev])
          }}
        />
      )}
    </Layout>
  )
}

// ─── Auth gate ──────────────────────────────────────────────────────────────
function AuthGate() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="w-6 h-6 rounded border-2 border-blue-500 border-t-transparent animate-spin" />
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
