import { DEFAULT_PORTFOLIO, PROPERTY_CATALOG } from '../data/propertyCatalog'
import { resolveBucket, CROSS_BUCKET_MEMBERS } from './invoiceRouting'

function normalizeMatchValue(value) {
  if (value == null) return ''
  return String(value).trim().toLowerCase()
}

function entryMatchesValue(entry, normalizedValue) {
  if (!normalizedValue) return false

  if (normalizeMatchValue(entry.property_name) === normalizedValue) return true
  if (normalizeMatchValue(entry.entity_code) === normalizedValue) return true
  if (normalizeMatchValue(entry.entity_name) === normalizedValue) return true

  if (Array.isArray(entry.property_codes) && entry.property_codes.some(code => normalizeMatchValue(code) === normalizedValue)) {
    return true
  }

  return false
}

export function normalizeGlSplit(split = {}) {
  return {
    entity_code: typeof split.entity_code === 'string' ? split.entity_code : '',
    entity_name: typeof split.entity_name === 'string' ? split.entity_name : '',
    gl_code: typeof split.gl_code === 'string' ? split.gl_code : '',
    amount: split.amount == null || split.amount === '' || Number.isNaN(Number(split.amount)) ? null : Number(split.amount),
    description: typeof split.description === 'string' ? split.description : '',
  }
}

export function normalizeGlSplits(glSplits, invoice = null) {
  if (typeof glSplits === 'string') {
    try {
      return normalizeGlSplits(JSON.parse(glSplits), invoice)
    } catch {
      return normalizeGlSplits([], invoice)
    }
  }

  if (Array.isArray(glSplits) && glSplits.length > 0) {
    return glSplits.map(normalizeGlSplit)
  }

  const portfolio = resolvePortfolio(invoice?.property_name, invoice?.portfolio_override)

  if (invoice?.gl_code) {
    return [{
      entity_code: portfolio.entity_code,
      entity_name: portfolio.entity_name,
      gl_code: invoice.gl_code,
      amount: invoice.amount ?? null,
      description: invoice.description || '',
    }]
  }

  if (invoice?.amount != null && portfolio.portfolio_key !== DEFAULT_PORTFOLIO.portfolio_key) {
    return [{
      entity_code: portfolio.entity_code,
      entity_name: portfolio.entity_name,
      gl_code: '',
      amount: Number(invoice.amount),
      description: invoice.description || 'Default allocation',
    }]
  }

  return []
}

export function createEmptyGlSplit(invoice = null) {
  const portfolio = resolvePortfolio(invoice?.property_name, invoice?.portfolio_override)
  return {
    entity_code: portfolio.entity_code,
    entity_name: portfolio.entity_name,
    gl_code: '',
    amount: null,
    description: '',
  }
}

export function calculateSplitTotal(glSplits = []) {
  return glSplits.reduce((total, split) => total + (Number(split.amount) || 0), 0)
}

export function hasSplitMismatch(invoiceAmount, glSplits = []) {
  if (invoiceAmount == null || glSplits.length === 0) return false
  return Math.abs(calculateSplitTotal(glSplits) - Number(invoiceAmount)) > 0.009
}

export function allocationBlockReason(invoiceAmount, glSplits = []) {
  if (!Array.isArray(glSplits) || glSplits.length === 0) {
    return 'Add at least one accounting allocation row before approval.'
  }
  if (hasSplitMismatch(invoiceAmount, glSplits)) {
    return 'Allocation total must equal invoice total before approval.'
  }
  return null
}

export function resolvePortfolio(propertyName, portfolioOverride = null) {
  const normalizedOverride = typeof portfolioOverride === 'string' ? portfolioOverride.trim().toLowerCase() : ''
  if (normalizedOverride) {
    const overrideMatch = PROPERTY_CATALOG.find(entry => entry.portfolio_key === normalizedOverride)
    if (overrideMatch) return overrideMatch
  }

  const normalizedProperty = normalizeMatchValue(propertyName)
  if (!normalizedProperty) return DEFAULT_PORTFOLIO

  const match = PROPERTY_CATALOG.find(entry => entryMatchesValue(entry, normalizedProperty))
  return match || DEFAULT_PORTFOLIO
}

export function portfolioState(invoice) {
  // Primary routing: entity number via BUCKET_ROUTES config (src/lib/invoiceRouting.js).
  const bucket = resolveBucket(invoice)
  if (bucket) {
    return {
      portfolio_key: bucket.portfolio_key,
      portfolio_label: bucket.portfolio_label,
      entity_code: bucket.entity_number || '',
      entity_name: bucket.entity_name || '',
      isMapped: true,
      isManual: bucket.source === 'override',
      routingSource: bucket.source,
      suggestedAssignee: bucket.suggestedAssignee,
      members: bucket.members || [],
    }
  }

  // Legacy fallback: property_name → PROPERTY_CATALOG. Kept so existing demo
  // invoices that carry only a property_name continue to classify correctly.
  const portfolio = resolvePortfolio(invoice?.property_name, invoice?.portfolio_override)
  return {
    ...portfolio,
    isMapped: portfolio.portfolio_key !== DEFAULT_PORTFOLIO.portfolio_key,
    isManual: !!invoice?.portfolio_override,
    routingSource: portfolio.portfolio_key === DEFAULT_PORTFOLIO.portfolio_key ? 'unmapped' : 'property',
    suggestedAssignee: null,
    members: [...CROSS_BUCKET_MEMBERS],
  }
}

const CANONICAL_PORTFOLIO_ORDER = [
  { key: 'operations',  label: 'Operations'  },
  { key: 'storage',     label: 'Storage'     },
  { key: 'unmapped',    label: 'Unmapped'    },
  { key: 'tahoe',       label: 'Tahoe'       },
  { key: 'farmington',  label: 'Farmington'  },
  { key: 'management',  label: 'Management'  },
  { key: 'buildco',     label: 'BuildCo'     },
]

export function portfolioTabsForInvoices(invoices = []) {
  const counts = new Map()

  for (const invoice of invoices) {
    const portfolio = resolvePortfolio(invoice.property_name, invoice.portfolio_override)
    counts.set(portfolio.portfolio_key, (counts.get(portfolio.portfolio_key) || 0) + 1)
  }

  const derivedTabs = CANONICAL_PORTFOLIO_ORDER.map(({ key, label }) => ({
    key,
    label,
    count: counts.get(key) || 0,
  }))

  return [{ key: 'all', label: 'All', count: invoices.length }, ...derivedTabs]
}
