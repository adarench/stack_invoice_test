import { supabase } from '../lib/supabaseClient'

const PROFILE_SELECT = 'id, email, full_name, role, created_at'

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

function deriveFullName(authUser) {
  const metadataName = authUser?.user_metadata?.full_name
  if (typeof metadataName === 'string' && metadataName.trim()) return metadataName.trim()
  const email = normalizeEmail(authUser?.email)
  return email ? email.split('@')[0] : 'User'
}

async function findProfileById(id) {
  if (!supabase || !id) return null

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data
}

async function findProfileByEmail(email) {
  const normalizedEmail = normalizeEmail(email)
  if (!supabase || !normalizedEmail) return null

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .ilike('email', normalizedEmail)
    .maybeSingle()

  if (error) throw error
  return data
}

async function syncProfileMetadata(profile, { email, fullName }) {
  if (!supabase || !profile?.id) return profile

  const updates = {}
  const normalizedEmail = normalizeEmail(email)

  if (normalizedEmail && normalizeEmail(profile.email) !== normalizedEmail) {
    updates.email = normalizedEmail
  }

  if (fullName && fullName !== profile.full_name) {
    updates.full_name = fullName
  }

  if (Object.keys(updates).length === 0) return profile

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', profile.id)
    .select(PROFILE_SELECT)
    .single()

  if (error) throw error
  return data
}

async function insertProfile({ id, email, fullName }) {
  if (!supabase || !id) return null

  const insertRow = {
    id,
    email: normalizeEmail(email) || null,
    full_name: fullName || null,
  }

  const { data, error } = await supabase
    .from('profiles')
    .insert(insertRow)
    .select(PROFILE_SELECT)
    .single()

  if (error) throw error
  return data
}

/**
 * Resolve a canonical profiles row for an application user.
 *
 * The hosted pilot has historical seeded profile IDs that do not always match
 * auth.users IDs. We therefore resolve in this order:
 * 1. direct profile id
 * 2. unique email match
 * 3. create a new profile row when explicitly allowed
 */
export async function resolveProfileRecord({ id, email, fullName, allowInsert = false }) {
  if (!supabase) return null

  const normalizedId = typeof id === 'string' && id.trim() ? id.trim() : null
  const normalizedEmail = normalizeEmail(email)
  const normalizedFullName = typeof fullName === 'string' && fullName.trim()
    ? fullName.trim()
    : null

  let profile = normalizedId ? await findProfileById(normalizedId) : null
  if (profile) return await syncProfileMetadata(profile, { email: normalizedEmail, fullName: normalizedFullName })

  profile = normalizedEmail ? await findProfileByEmail(normalizedEmail) : null
  if (profile) return await syncProfileMetadata(profile, { email: normalizedEmail, fullName: normalizedFullName })

  if (!allowInsert || !normalizedId) return null

  try {
    return await insertProfile({ id: normalizedId, email: normalizedEmail, fullName: normalizedFullName })
  } catch (error) {
    // Unique-email races are recoverable; re-read the row and use it.
    if (error?.code === '23505' && normalizedEmail) {
      return await findProfileByEmail(normalizedEmail)
    }
    throw error
  }
}

export async function ensureProfileForAuthUser(authUser) {
  if (!authUser?.id) return null

  return resolveProfileRecord({
    id: authUser.id,
    email: authUser.email,
    fullName: deriveFullName(authUser),
    allowInsert: true,
  })
}

export async function resolveProfileId({ id, email, fullName, allowInsert = false }) {
  const profile = await resolveProfileRecord({ id, email, fullName, allowInsert })
  return profile?.id || null
}

export function buildFallbackUser(authUser) {
  return {
    id: authUser?.id || null,
    auth_id: authUser?.id || null,
    profile_id: authUser?.id || null,
    email: authUser?.email || null,
    full_name: deriveFullName(authUser),
    role: 'ops',
    user_metadata: authUser?.user_metadata || {},
  }
}
