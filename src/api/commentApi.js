import { supabase } from '../lib/supabaseClient'

/**
 * Fetch all comments for an invoice, ordered oldest-first.
 */
export async function fetchComments(invoiceId) {
  const { data, error } = await supabase
    .from('comments')
    .select('*, user:profiles(id, full_name, email)')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

/**
 * Add a comment to an invoice. Returns the new comment with the user profile attached.
 */
export async function addComment(invoiceId, userId, content) {
  const { data, error } = await supabase
    .from('comments')
    .insert({ invoice_id: invoiceId, user_id: userId, content })
    .select('*, user:profiles(id, full_name, email)')
    .single()
  if (error) throw error
  return data
}
