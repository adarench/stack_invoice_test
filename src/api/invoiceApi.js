import { supabase } from '../lib/supabaseClient'
import { DEMO_USERS } from '../data/demoUsers'
import { normalizeGlSplits } from '../lib/invoiceAccounting'
import { resolveProfileId } from './profileApi'

// Demo user IDs
const DEMO_USER_IDS = new Set(DEMO_USERS.map(u => u.id))

// Cache: have we verified/seeded demo users in profiles?
let demoUsersVerified = false

function normalizeNotifications(notifications) {
  if (!notifications || typeof notifications !== 'object' || Array.isArray(notifications)) {
    return {}
  }

  const reviewEmailSent = notifications.reviewEmailSent === true
  return {
    ...notifications,
    reviewEmailSent,
    lastNotifiedAt: typeof notifications.lastNotifiedAt === 'string' ? notifications.lastNotifiedAt : null,
    lastNotifiedUserId: typeof notifications.lastNotifiedUserId === 'string' ? notifications.lastNotifiedUserId : null,
    lastNotifiedEmail: typeof notifications.lastNotifiedEmail === 'string' ? notifications.lastNotifiedEmail : null,
    lastNotifiedName: typeof notifications.lastNotifiedName === 'string' ? notifications.lastNotifiedName : null,
  }
}

async function ensureDemoUsersExist() {
  if (demoUsersVerified) return true
  if (!supabase) return false
  try {
    // Check if any demo user exists
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .in('id', [...DEMO_USER_IDS])
    if (data && data.length >= DEMO_USERS.length) {
      demoUsersVerified = true
      return true
    }
    // Try to insert missing demo users
    const existingIds = new Set((data || []).map(r => r.id))
    const missing = DEMO_USERS
      .filter(u => !existingIds.has(u.id))
      .map(u => ({ id: u.id, email: u.email, full_name: u.full_name, role: u.role }))
    if (missing.length > 0) {
      const { error } = await supabase.from('profiles').upsert(missing, { onConflict: 'id' })
      if (error) {
        console.warn('[invoiceApi] Could not seed demo users:', error.message)
        // If some exist, still mark as verified
        demoUsersVerified = (data && data.length > 0)
        return demoUsersVerified
      }
      console.info('[invoiceApi] Seeded demo users into profiles table')
    }
    demoUsersVerified = true
    return true
  } catch (err) {
    console.warn('[invoiceApi] Demo user check failed:', err)
    return false
  }
}

// Base select — only join FKs that exist in the initial schema.
const BASE_SELECT = `
  *,
  assigned_user:profiles!invoices_assigned_to_fkey(id, full_name, email, role),
  uploader:profiles!invoices_uploaded_by_fkey(id, full_name, email, role)
`

const WORKFLOW_SELECT = BASE_SELECT + `,
  reviewer:profiles!invoices_reviewed_by_fkey(id, full_name, email, role),
  assigned_reviewer:profiles!invoices_assigned_reviewer_id_fkey(id, full_name, email, role),
  approver:profiles!invoices_approved_by_fkey(id, full_name, email, role),
  payer:profiles!invoices_paid_by_fkey(id, full_name, email, role)
`

/**
 * Fetch all invoices with related profiles.
 * Tries the reviewer join; falls back to base select if the FK doesn't exist yet.
 */
export async function fetchInvoices() {
  // Try with the full workflow join first
  let { data, error } = await supabase
    .from('invoices')
    .select(WORKFLOW_SELECT)
    .order('created_at', { ascending: false })

  if (error) {
    // Fallback: workflow FK columns don't exist yet
    console.warn('[invoiceApi] workflow joins failed, using base select:', error.message)
    ;({ data, error } = await supabase
      .from('invoices')
      .select(BASE_SELECT)
      .order('created_at', { ascending: false }))
    if (error) throw error
  }
  return (data || []).map(invoice => ({
    ...invoice,
    gl_splits: normalizeGlSplits(invoice.gl_splits, invoice),
    notifications: normalizeNotifications(invoice.notifications),
  }))
}

/**
 * Fetch a single invoice by ID.
 */
export async function fetchInvoice(id) {
  let { data, error } = await supabase
    .from('invoices')
    .select(WORKFLOW_SELECT)
    .eq('id', id)
    .single()

  if (error && (
    error.message?.includes('reviewed_by') ||
    error.message?.includes('assigned_reviewer_id') ||
    error.message?.includes('approved_by') ||
    error.message?.includes('paid_by')
  )) {
    ;({ data, error } = await supabase
      .from('invoices')
      .select(BASE_SELECT)
      .eq('id', id)
      .single())
    if (error) throw error
  } else if (error) {
    throw error
  }
  return {
    ...data,
    gl_splits: normalizeGlSplits(data.gl_splits, data),
    notifications: normalizeNotifications(data.notifications),
  }
}

/**
 * Create a new invoice record (after file upload).
 * Validates uploaded_by against the profiles table to avoid FK violations.
 */
export async function createInvoice({
  vendorName, propertyName, invoiceNumber, amount, fileUrl, uploadedBy, uploadedByEmail, uploadedByName,
  invoiceDate, dueDate, billToName, description, lineItems, rawText,
  parseStatus, parseErrors, parseMethod, parseConfidence, parseMetadata, source, vendorEmail, documentType, notes, glSplits,
}) {
  // Determine the canonical profiles.id for uploaded_by:
  // - Demo IDs are kept for local/demo mode after seeding
  // - Hosted/authenticated users resolve against profiles by id or email
  // - Brand-new authenticated users can bootstrap a profile row on first write
  let safeUploadedBy = null
  if (uploadedBy && /^[0-9a-f-]{36}$/.test(uploadedBy)) {
    if (DEMO_USER_IDS.has(uploadedBy)) {
      const exists = await ensureDemoUsersExist()
      safeUploadedBy = exists ? uploadedBy : null
    } else {
      safeUploadedBy = await resolveProfileId({
        id: uploadedBy,
        email: uploadedByEmail,
        fullName: uploadedByName,
        allowInsert: true,
      })

      if (!safeUploadedBy) {
        throw new Error(`Unable to resolve uploader profile for ${uploadedByEmail || uploadedBy}`)
      }
    }
  }

  console.debug('[invoiceApi] uploaded_by resolution:', { raw: uploadedBy, safe: safeUploadedBy })

  const row = {
    vendor_name:    vendorName || null,
    property_name:  propertyName || null,
    invoice_number: invoiceNumber || null,
    amount:         amount ?? null,
    status:         'uploaded',
    file_url:       fileUrl,
    uploaded_by:    safeUploadedBy,
    invoice_date:   invoiceDate || null,
    due_date:       dueDate || null,
    bill_to_name:   billToName || null,
    description:    description || null,
    line_items:     lineItems && lineItems.length > 0 ? JSON.stringify(lineItems) : '[]',
    raw_text:       rawText || null,
    parse_status:   parseStatus || null,
    parse_errors:   parseErrors || null,
    parse_method:   parseMethod || null,
    parse_confidence: parseConfidence ?? null,
    parse_metadata: parseMetadata || {},
    source:         source || null,
    vendor_email:   vendorEmail || null,
    document_type:  documentType || null,
    notes:          notes || null,
    gl_splits:      JSON.stringify(normalizeGlSplits(glSplits)),
    portfolio_override: null,
    notifications:  {},
  }

  console.debug('[invoiceApi] createInvoice row:', row)

  const { data, error } = await supabase
    .from('invoices')
    .insert(row)
    .select()
    .single()

  if (error) {
    // If the error is about unknown columns (migration 006 not applied), retry without them
    const optionalCols = [
      'vendor_email',
      'document_type',
      'notes',
      'gl_splits',
      'portfolio_override',
      'notifications',
      'parse_method',
      'parse_confidence',
      'parse_metadata',
    ]
    if (error.message && optionalCols.some(c => error.message.includes(c))) {
      console.warn('[invoiceApi] vendor columns not found, retrying without them:', error.message)
      const safeRow = Object.fromEntries(
        Object.entries(row).filter(([k]) => !optionalCols.includes(k))
      )
      const retry = await supabase.from('invoices').insert(safeRow).select().single()
      if (retry.error) throw retry.error
      return {
        ...retry.data,
        gl_splits: normalizeGlSplits(retry.data.gl_splits, retry.data),
        notifications: normalizeNotifications(retry.data.notifications),
      }
    }
    throw error
  }
  return {
    ...data,
    gl_splits: normalizeGlSplits(data.gl_splits, data),
    notifications: normalizeNotifications(data.notifications),
  }
}

/**
 * Update mutable fields on an invoice.
 * Sanitizes FK user IDs and drops unknown columns gracefully.
 */
export async function updateInvoice(id, updates) {
  // Sanitize any FK fields that reference profiles — demo user IDs may not exist
  const fkFields = ['assigned_to', 'reviewed_by', 'uploaded_by']
  const sanitized = { ...updates }
  for (const field of fkFields) {
    if (field in sanitized && sanitized[field] && DEMO_USER_IDS.has(sanitized[field])) {
      const exists = await ensureDemoUsersExist()
      if (!exists) sanitized[field] = null
    }
  }

  // Columns that only exist after migration 003
  const workflowCols = [
    'reviewed_by',
    'assigned_reviewer_id',
    'approved_by',
    'approved_at',
    'rejected_at',
    'paid_by',
    'paid_at',
    'last_action_at',
  ]
  if ('gl_splits' in sanitized) {
    sanitized.gl_splits = normalizeGlSplits(sanitized.gl_splits, sanitized)
  }

  if ('notifications' in sanitized) {
    sanitized.notifications = normalizeNotifications(sanitized.notifications)
  }

  const optionalCols = ['gl_splits', 'portfolio_override', 'notifications']

  const { data, error } = await supabase
    .from('invoices')
    .update(sanitized)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.message && optionalCols.some(col => error.message.includes(col))) {
      const safe = Object.fromEntries(
        Object.entries(sanitized).filter(([k]) => !optionalCols.includes(k))
      )
      if (Object.keys(safe).length === 0) return { id, ...sanitized }
      const retry = await supabase
        .from('invoices')
        .update(safe)
        .eq('id', id)
        .select()
        .single()
      if (retry.error) throw retry.error
      return {
        ...retry.data,
        gl_splits: normalizeGlSplits(retry.data.gl_splits, retry.data),
        notifications: normalizeNotifications(retry.data.notifications),
      }
    }

    // Enum values added by migration 003: map to closest existing value so the workflow
    // still persists correctly even if migrations haven't been applied yet.
    const ENUM_REMAP = { 'in_review': 'under_review', 'paid': null }
    const hasWorkflowCol = workflowCols.some(col => col in sanitized)
    const hasEnumError = error.message?.includes('invalid input value for enum')

    if (hasWorkflowCol || hasEnumError) {
      console.warn('[invoiceApi] update failed, applying schema fallbacks:', error.message)

      // Strip columns that don't exist yet
      let safe = Object.fromEntries(
        Object.entries(sanitized).filter(([k]) => !workflowCols.includes(k))
      )

      // Remap enum values that don't exist yet
      if (safe.status && safe.status in ENUM_REMAP) {
        const remapped = ENUM_REMAP[safe.status]
        if (remapped) {
          safe.status = remapped
        } else {
          // e.g. 'paid' has no equivalent — skip status persistence
          delete safe.status
        }
      }

      if (Object.keys(safe).length === 0) return { id, ...sanitized }
      const retry = await supabase
        .from('invoices')
        .update(safe)
        .eq('id', id)
        .select()
        .single()

      if (retry.error) {
        // Final fallback: enum error still present — drop status entirely
        if (retry.error.message?.includes('invalid input value for enum') && 'status' in safe) {
          delete safe.status
          if (Object.keys(safe).length === 0) return { id, ...sanitized }
          const last = await supabase
            .from('invoices')
            .update(safe)
            .eq('id', id)
            .select()
            .single()
          if (last.error) throw last.error
          return last.data
        }
        throw retry.error
      }
      return {
        ...retry.data,
        gl_splits: normalizeGlSplits(retry.data.gl_splits, retry.data),
        notifications: normalizeNotifications(retry.data.notifications),
      }
    }
    throw error
  }
  return {
    ...data,
    gl_splits: normalizeGlSplits(data.gl_splits, data),
    notifications: normalizeNotifications(data.notifications),
  }
}

/**
 * Delete an invoice by ID. Also attempts to remove the PDF from storage.
 */
export async function deleteInvoice(id, fileUrl) {
  if (!supabase) return

  if (fileUrl) {
    try {
      const url = new URL(fileUrl)
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/invoices\/(.+)/)
      if (pathMatch?.[1]) {
        await supabase.storage.from('invoices').remove([decodeURIComponent(pathMatch[1])])
      }
    } catch (e) {
      console.warn('[invoiceApi] Could not remove PDF from storage:', e.message)
    }
  }

  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id)

  if (error) throw error
}

/**
 * Upload a PDF file to Supabase Storage and return its public URL.
 */
export async function uploadInvoiceFile(file, userId) {
  const ext = file.name.split('.').pop()
  const folder = /^[0-9a-f-]{36}$/.test(userId) ? userId : (userId || 'demo')
  const path = `${folder}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('invoices')
    .upload(path, file, { contentType: file.type, upsert: false })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('invoices').getPublicUrl(path)
  return data.publicUrl
}

/**
 * Check for potential duplicate invoices before upload.
 * Returns { isDuplicate, matches, matchType }.
 * Non-blocking — returns safe default on any error.
 */
export async function checkDuplicateInvoice({ vendorName, invoiceNumber, amount }) {
  const safe = { isDuplicate: false, matches: [], matchType: null }
  if (!supabase || !vendorName?.trim()) return safe

  try {
    const name = vendorName.trim()

    // Primary: vendor_name + invoice_number (case-insensitive)
    if (invoiceNumber?.trim()) {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, vendor_name, invoice_number, amount, property_name, created_at, status')
        .ilike('vendor_name', name)
        .ilike('invoice_number', invoiceNumber.trim())
        .limit(3)
      if (!error && data && data.length > 0) {
        return { isDuplicate: true, matches: data, matchType: 'exact' }
      }
    }

    // Secondary fallback: vendor_name + amount (when no invoice number)
    if (amount != null && amount !== '' && !isNaN(parseFloat(amount))) {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, vendor_name, invoice_number, amount, property_name, created_at, status')
        .ilike('vendor_name', name)
        .eq('amount', parseFloat(amount))
        .limit(3)
      if (!error && data && data.length > 0) {
        return { isDuplicate: true, matches: data, matchType: 'amount' }
      }
    }

    return safe
  } catch (err) {
    console.warn('[invoiceApi] duplicate check failed:', err)
    return safe
  }
}
