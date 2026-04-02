import { DEMO_USERS } from '../data/demoUsers'

/**
 * Return the canonical user list for assignment dropdowns and user lookups.
 * In demo/pilot mode, DEMO_USERS is the single source of truth.
 */
export async function fetchUsers() {
  return DEMO_USERS.map(u => ({
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    role: u.role,
  }))
}
