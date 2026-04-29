// Source of truth: src/data/glCodeCatalog.json (regenerate via
// `python3 scripts/buildGlCatalog.py`).
//
// The JSON file holds all 1,077 postable (Reg) accounts from the chart of
// accounts Excel. This module exposes a UI-friendly view: only the expense
// accounts (5xxx + 6xxx) that invoices code to, mapped to the legacy
// {code, name, category, recoverable} shape used across the app.

import rawCatalog from './glCodeCatalog.json'

export const FULL_GL_CATALOG = rawCatalog

export const glCodeCatalog = rawCatalog
  .filter(entry => entry.type === 'Expense')
  .map(entry => ({
    code: entry.gl_code,
    name: entry.gl_description,
    category: entry.category,
    recoverable: entry.recoverable,
  }))

export const GL_ACCOUNTS = glCodeCatalog

const _index = new Map(glCodeCatalog.map(account => [account.code, account]))

export const GL_CATEGORIES = Array.from(
  new Set(glCodeCatalog.map(account => account.category))
).sort()

export function normalizeGlCode(code) {
  if (!code) return ''

  const raw = String(code).trim()
  if (_index.has(raw)) return raw

  const codeMatch = raw.match(/(\d{4})(?:-(\d{2}))?/)
  if (!codeMatch) return raw

  const normalized = codeMatch[2]
    ? `${codeMatch[1]}-${codeMatch[2]}`
    : `${codeMatch[1]}-00`

  return _index.has(normalized) ? normalized : raw
}

export function formatGlAccountLabel(accountOrCode) {
  const account = typeof accountOrCode === 'string'
    ? findGlAccount(accountOrCode)
    : accountOrCode

  if (!account) return typeof accountOrCode === 'string' ? accountOrCode : ''
  return `${account.code} - ${account.name}`
}

export function findGlAccount(code) {
  const normalized = normalizeGlCode(code)
  return _index.get(normalized) || null
}

export function validateGlCode(code) {
  if (!code) return { valid: false, level: 'empty', message: '' }
  const normalized = normalizeGlCode(code)
  const account = _index.get(normalized)
  if (account) return { valid: true, level: 'ok', message: '', account }
  const num = parseInt(String(normalized).split('-')[0], 10)
  if (num >= 4000 && num < 5000) return { valid: false, level: 'warning', message: 'Revenue account — invoices usually code to 5xxx or 6xxx' }
  if (num >= 1000 && num < 4000) return { valid: false, level: 'warning', message: 'Balance sheet account — invoices usually code to 5xxx or 6xxx' }
  return { valid: false, level: 'info', message: 'Not in Chart of Accounts' }
}

export function searchGlAccounts(query, { limit = null } = {}) {
  if (!query || !query.trim()) {
    return Number.isFinite(limit) ? glCodeCatalog.slice(0, limit) : glCodeCatalog
  }
  const q = query.trim().toLowerCase()
  const results = glCodeCatalog.filter(a =>
    a.code.toLowerCase().includes(q) ||
    a.name.toLowerCase().includes(q) ||
    a.category.toLowerCase().includes(q)
  )
  return Number.isFinite(limit) ? results.slice(0, limit) : results
}

export function getMirrorCode(code) {
  if (!code) return null
  const parts = code.split('-')
  const num = parseInt(parts[0])
  if (num >= 5000 && num < 6000) {
    const mirror = String(num + 1000) + '-' + (parts[1] || '00')
    return _index.has(mirror) ? mirror : null
  }
  if (num >= 6000 && num < 7000) {
    const mirror = String(num - 1000) + '-' + (parts[1] || '00')
    return _index.has(mirror) ? mirror : null
  }
  return null
}

const GL_KEYWORD_MAP = [
  { keywords: ['hvac', 'heating', 'cooling', 'air conditioning', 'a/c', 'furnace'], codes: ['5150-00', '6150-00'] },
  { keywords: ['elevator', 'lift', 'escalator'], codes: ['5111-00', '6111-00'] },
  { keywords: ['janitorial', 'cleaning', 'custodial', 'janitor'], codes: ['5181-00', '6181-00'] },
  { keywords: ['landscaping', 'lawn', 'irrigation', 'mowing', 'tree'], codes: ['5210-00', '6210-00'] },
  { keywords: ['electrical', 'wiring', 'electric'], codes: ['5090-00', '6090-00'] },
  { keywords: ['plumbing', 'drain', 'sewer', 'pipe', 'water heater'], codes: ['5370-00', '6370-00'] },
  { keywords: ['insurance'], codes: ['5161-00', '6161-00'] },
  { keywords: ['legal', 'attorney', 'law firm'], codes: ['5230-00', '6230-00'] },
  { keywords: ['painting', 'paint'], codes: ['5341-00', '6341-00'] },
  { keywords: ['roof', 'roofing'], codes: ['5428-00', '6428-00'] },
  { keywords: ['pest', 'exterminator', 'termite'], codes: ['5360-00', '6360-00'] },
  { keywords: ['security', 'guard', 'patrol'], codes: ['5436-00', '6436-00'] },
  { keywords: ['trash', 'waste', 'refuse', 'dumpster'], codes: ['5508-00', '6508-00'] },
  { keywords: ['water', 'sewer'], codes: ['5511-00', '6511-00'] },
  { keywords: ['gas', 'natural gas'], codes: ['5504-00', '6504-00'] },
  { keywords: ['telephone', 'phone', 'telecom'], codes: ['5507-00', '6507-00'] },
  { keywords: ['fire', 'sprinkler', 'fire safety'], codes: ['5131-00', '6131-00'] },
  { keywords: ['management fee'], codes: ['5261-00', '6261-00'] },
  { keywords: ['accounting', 'audit', 'cpa'], codes: ['5390-00', '6390-00'] },
]

export function suggestGlFromText(text) {
  if (!text) return []
  const lower = text.toLowerCase()
  const suggestions = []
  for (const mapping of GL_KEYWORD_MAP) {
    if (mapping.keywords.some(kw => lower.includes(kw))) {
      for (const code of mapping.codes) {
        const account = _index.get(code)
        if (account) suggestions.push(account)
      }
    }
  }
  return suggestions
}
