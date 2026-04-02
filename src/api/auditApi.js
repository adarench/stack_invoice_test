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
