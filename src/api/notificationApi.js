import { supabase } from '../lib/supabaseClient'
import { DEMO_USERS } from '../data/demoUsers'

const NOTIFICATIONS_ENABLED = import.meta.env.VITE_NOTIFICATIONS_ENABLED === 'true'

/**
 * Resolve who should receive an email for a given action.
 * Returns Array<{ email, name }>.
 */
export function resolveRecipients(action, invoice, currentUser, meta = {}) {
  const recipients = []
  const findUser = (id) => DEMO_USERS.find(u => u.id === id)

  switch (action) {
    case 'submit_for_review': {
      // Notify the assigned reviewer
      const reviewer = findUser(meta.userId)
      if (reviewer) recipients.push({ email: reviewer.email, name: reviewer.full_name })
      break
    }
    case 'approve':
    case 'reject':
    case 'send_back':
    case 'mark_paid': {
      // Notify uploader
      const uploader = findUser(invoice?.uploaded_by)
      if (uploader) recipients.push({ email: uploader.email, name: uploader.full_name })
      // Notify vendor if external submission
      if (invoice?.vendor_email && (invoice?.source === 'vendor' || invoice?.source === 'external_submission')) {
        recipients.push({ email: invoice.vendor_email, name: invoice.vendor_name || 'Vendor' })
      }
      break
    }
    case 'assign': {
      // Notify newly assigned user
      const assignee = findUser(meta.userId)
      if (assignee) recipients.push({ email: assignee.email, name: assignee.full_name })
      break
    }
    case 'vendor_submission': {
      // Notify all ops + admin users
      DEMO_USERS
        .filter(u => u.role === 'uploader' || u.role === 'admin')
        .forEach(u => recipients.push({ email: u.email, name: u.full_name }))
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
export async function sendNotification({ action, invoice, recipients, actor }) {
  if (!NOTIFICATIONS_ENABLED || !supabase || !recipients || recipients.length === 0) return null

  try {
    const { data, error } = await supabase.functions.invoke('send-notification', {
      body: { action, invoice, recipients, actor },
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
