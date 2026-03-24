import { useState } from 'react'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import InvoiceList from './components/InvoiceList'
import InvoiceDetail from './components/InvoiceDetail'
import ApprovalQueue from './components/ApprovalQueue'
import PaymentScreen from './components/PaymentScreen'
import AuditTrailView from './components/AuditTrailView'
import WorkOrders from './components/WorkOrders'
import { invoices as initialInvoices } from './data/mockData'

export default function App() {
  const [activeView, setActiveView] = useState('dashboard')
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null)
  const [invoices, setInvoices] = useState(initialInvoices)

  const now = () => {
    const d = new Date()
    return `2024-01-16 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  const handleInvoiceAction = (invoiceId, action, meta = {}) => {
    setInvoices(prev => prev.map(inv => {
      if (inv.id !== invoiceId) return inv
      switch (action) {
        case 'approve':
          return {
            ...inv,
            status: 'Approved',
            risk_flag: null,
            audit: [...inv.audit, {
              event: 'Approved',
              timestamp: now(),
              user: 'Test User',
              note: meta.note || 'Approved via OpsFlow',
            }],
          }
        case 'flag':
          return {
            ...inv,
            status: 'Flagged',
            risk_flag: 'manual',
            audit: [...inv.audit, {
              event: 'Flagged',
              timestamp: now(),
              user: 'Test User',
              note: meta.note || 'Flagged for manual review',
            }],
          }
        case 'request_review':
          return {
            ...inv,
            status: 'Under Review',
            audit: [...inv.audit, {
              event: 'Review Requested',
              timestamp: now(),
              user: 'Test User',
              note: meta.note || 'Sent back for facilities review',
            }],
          }
        case 'schedule_payment':
          return {
            ...inv,
            status: 'Payment Scheduled',
            audit: [...inv.audit, {
              event: 'Payment Scheduled',
              timestamp: now(),
              user: 'System',
              note: `${meta.method || 'ACH'} scheduled for ${meta.date || '2024-02-01'}`,
            }],
          }
        case 'process_payment':
          return {
            ...inv,
            status: 'Paid',
            audit: [
              ...inv.audit,
              {
                event: 'Paid',
                timestamp: now(),
                user: 'System',
                note: `${meta.method || 'ACH'} transfer completed — Ref: ${meta.ref || 'ACH-2024-0099'}`,
              },
              {
                event: 'Filed',
                timestamp: now(),
                user: 'System',
                note: 'Archived to document store',
              },
            ],
          }
        default:
          return inv
      }
    }))
  }

  const handleSelectInvoice = (invoice) => {
    setSelectedInvoiceId(invoice.id)
    setActiveView('invoice-detail')
  }

  const selectedInvoice = invoices.find(i => i.id === selectedInvoiceId)

  return (
    <ThemeProvider>
    <Layout activeView={activeView} setActiveView={setActiveView} invoices={invoices}>
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
          onSelectInvoice={handleSelectInvoice}
        />
      )}
      {activeView === 'invoice-detail' && selectedInvoice && (
        <InvoiceDetail
          invoice={selectedInvoice}
          onAction={handleInvoiceAction}
          onBack={() => setActiveView('invoices')}
        />
      )}
      {activeView === 'approvals' && (
        <ApprovalQueue
          invoices={invoices}
          onSelectInvoice={handleSelectInvoice}
          onAction={handleInvoiceAction}
        />
      )}
      {activeView === 'payments' && (
        <PaymentScreen
          invoices={invoices}
          onAction={handleInvoiceAction}
          onSelectInvoice={handleSelectInvoice}
        />
      )}
      {activeView === 'audit' && (
        <AuditTrailView
          invoices={invoices}
          onSelectInvoice={handleSelectInvoice}
        />
      )}
      {activeView === 'workorders' && (
        <WorkOrders />
      )}
    </Layout>
    </ThemeProvider>
  )
}
