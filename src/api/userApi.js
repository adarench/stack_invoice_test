import { supabase } from '../lib/supabaseClient'
import { DEMO_USERS, normalizeRole } from '../data/demoUsers'

const PRIMARY_ROLE_EMAILS = Object.fromEntries(
  DEMO_USERS.map(user => [user.role, user.email.toLowerCase()])
)

function isSeededDemoId(id) {
  return typeof id === 'string' && id.startsWith('00000000-0000-0000-0000-')
}

function formatDisplayName(fullName, email) {
  const source = fullName || email?.split('@')[0] || ''
  return source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function roleRank(role) {
  switch (role) {
    case 'admin': return 6
    case 'accounting': return 5
    case 'approver': return 4
    case 'ops': return 3
    case 'reviewer': return 2
    case 'uploader': return 1
    default: return 0
  }
}

function dedupeUsers(users) {
  const merged = new Map()

  for (const user of users) {
    const normalizedEmail = user.email?.trim().toLowerCase() || ''
    const normalizedName = user.full_name?.trim().toLowerCase() || ''
    const key = normalizedEmail || normalizedName
    if (!key) continue

    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, {
        ...user,
        email: normalizedEmail || user.email,
        full_name: formatDisplayName(user.full_name, user.email) || user.full_name,
      })
      continue
    }

    const preferredId = !isSeededDemoId(existing.id) ? existing.id : (!isSeededDemoId(user.id) ? user.id : existing.id)
    const preferredRole = roleRank(user.role) > roleRank(existing.role) ? user.role : existing.role
    const preferredName = formatDisplayName(
      roleRank(user.role) > roleRank(existing.role) ? user.full_name : existing.full_name,
      user.email || existing.email
    ) || existing.full_name || user.full_name

    merged.set(key, {
      ...existing,
      ...user,
      id: preferredId,
      email: normalizedEmail || existing.email || user.email,
      role: preferredRole,
      full_name: preferredName,
    })
  }

  return Array.from(merged.values()).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
}

/**
 * Return the canonical user list for assignment dropdowns and user lookups.
 * In hosted mode, profiles is the source of truth. Demo mode falls back to DEMO_USERS.
 */
export async function fetchUsers() {
  if (supabase) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .order('full_name', { ascending: true })

    if (error) throw error
    return dedupeUsers((data || []).filter(user => normalizeRole(user.role) !== 'vendor'))
  }

  return dedupeUsers(DEMO_USERS
    .filter(user => normalizeRole(user.role) !== 'vendor')
    .map(u => ({
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    role: u.role,
    })))
}

export async function fetchPrimaryUser(role) {
  const fallback = DEMO_USERS.find(user => user.role === role) || null

  if (supabase) {
    const targetEmail = PRIMARY_ROLE_EMAILS[role]
    const query = supabase
      .from('profiles')
      .select('id, full_name, email, role')

    const { data, error } = targetEmail
      ? await query.ilike('email', targetEmail)
      : await query.eq('role', role).order('created_at', { ascending: true })

    if (error) throw error
    const deduped = dedupeUsers((data || []).filter(user => normalizeRole(user.role) !== 'vendor'))
    if (deduped.length > 0) return deduped[0]
  }

  return fallback
}
