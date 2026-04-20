import { supabase } from '../lib/supabaseClient'

/**
 * Fetch all audit log entries for an invoice, ordered oldest-first.
 */
export async function fetchAuditLogs(invoiceId) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*, user:profiles(id, full_name, email)')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

/**
 * Append an audit log entry for an invoice action.
 */
export async function createAuditLog(invoiceId, userId, action, note = null) {
  const { error } = await supabase
    .from('audit_logs')
    .insert({ invoice_id: invoiceId, user_id: userId, action, note })
  if (error) throw error
}

/**
 * Fetch the most recent activity across all invoices (for the dashboard feed).
 */
export async function fetchRecentActivity(limit = 12) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select(`
      *,
      user:profiles(id, full_name, email, role),
      invoice:invoices(id, vendor_name, property_name, amount, invoice_number, status)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.warn('[auditApi] fetchRecentActivity failed:', error.message)
    return []
  }
  return data || []
}
