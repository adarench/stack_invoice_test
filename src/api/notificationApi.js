import { supabase } from '../lib/supabaseClient'
import { DEMO_USERS } from '../data/demoUsers'

const NOTIFICATIONS_ENABLED = import.meta.env.VITE_NOTIFICATIONS_ENABLED === 'true'

/**
 * Resolve who should receive an email for a given action.
 * Returns Array<{ email, name }>.
 */
export async function resolveRecipients(action, invoice, currentUser, meta = {}) {
  const recipients = []
  const findUser = (id) => DEMO_USERS.find(u => u.id === id)
  const profileById = async (id) => {
    if (!id || !supabase) return null
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', id)
      .maybeSingle()
    if (error) {
      console.warn('[notificationApi] Failed to load profile:', error.message)
      return null
    }
    return data
  }
  const profilesByRoles = async (roles) => {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .in('role', roles)
    if (error) {
      console.warn('[notificationApi] Failed to load recipients:', error.message)
      return []
    }
    return data || []
  }

  switch (action) {
    case 'review_pending':
    case 'submit_for_review': {
      // Notify the assigned reviewer
      const reviewer = meta.userProfile || await profileById(meta.userId) || findUser(meta.userId)
      if (reviewer) recipients.push({ email: reviewer.email, name: reviewer.full_name })
      break
    }
    case 'approve':
    case 'reject':
    case 'send_back':
    case 'mark_paid': {
      // Notify uploader
      const uploader = invoice?.uploader || await profileById(invoice?.uploaded_by) || findUser(invoice?.uploaded_by)
      if (uploader) recipients.push({ email: uploader.email, name: uploader.full_name })
      // Notify vendor if external submission
      if (invoice?.vendor_email && (invoice?.source === 'vendor' || invoice?.source === 'external_submission')) {
        recipients.push({ email: invoice.vendor_email, name: invoice.vendor_name || 'Vendor' })
      }
      break
    }
    case 'assign': {
      // Notify newly assigned user
      const assignee = meta.userProfile || await profileById(meta.userId) || findUser(meta.userId)
      if (assignee) recipients.push({ email: assignee.email, name: assignee.full_name })
      break
    }
    case 'vendor_submission': {
      // Notify all ops + admin users
      const liveRecipients = await profilesByRoles(['ops', 'uploader', 'admin'])
      if (liveRecipients.length > 0) {
        liveRecipients.forEach(u => recipients.push({ email: u.email, name: u.full_name }))
      } else {
        DEMO_USERS
          .filter(u => u.role === 'ops' || u.role === 'uploader' || u.role === 'admin')
          .forEach(u => recipients.push({ email: u.email, name: u.full_name }))
      }
      break
    }
  }

  // Filter out the actor (don't notify yourself)
  // Filter out .local emails (not real until replaced)
  return recipients.filter(r =>
    r.email !== currentUser?.email &&
    !r.email?.endsWith('.local')
  )
}

/**
 * Send email notification via Supabase Edge Function.
 * Fire-and-forget — never throws, never blocks the workflow.
 */
export async function sendNotification({ action, invoice, recipients, actor, link }) {
  if (!NOTIFICATIONS_ENABLED || !supabase || !recipients || recipients.length === 0) return null

  try {
    const { data, error } = await supabase.functions.invoke('send-notification', {
      body: { action, invoice, recipients, actor, link },
    })

    if (error) {
      console.warn('[notificationApi] Edge function error:', error)
      return null
    }

    console.debug('[notificationApi] Notification sent:', data)
    return data
  } catch (err) {
    console.warn('[notificationApi] Failed to send notification:', err)
    return null
  }
}
