// ─────────────────────────────────────────────────────────────────────────────
// Invoice bucket routing config
// ─────────────────────────────────────────────────────────────────────────────
// This is the single editable source of truth for:
//   - entity-number → bucket classification
//   - bucket → team members / suggested queue owner
//
// Resolution order when classifying an invoice:
//   1. portfolio_override (explicit manual override on the invoice)
//   2. entity number exact match across all buckets
//   3. entity number pattern match across all buckets
//   4. property_name catalog fallback (legacy PROPERTY_CATALOG)
//   5. unmapped
//
// Exact matches are evaluated across ALL buckets before any pattern, so
// Farmington 3500 will never be shadowed by Storage's 3500-series pattern.
// ─────────────────────────────────────────────────────────────────────────────

// ── People directory ─────────────────────────────────────────────────────────
// Central list of everyone in the system. Referenced by buckets below.

export const PEOPLE = {
  sharon:   { email: 'sharon@stackwithus.com',     full_name: 'Sharon' },
  jen:      { email: 'jen@stackwithus.com',         full_name: 'Jen' },
  andrew:   { email: 'andrew@stackwithus.com',      full_name: 'Andrew' },
  kelson:   { email: 'kelson@stackwithus.com',       full_name: 'Kelson' },
  fernando: { email: 'fernando@stackwithus.com',     full_name: 'Fernando' },
  jessica:  { email: 'jessica@stackwithus.com',      full_name: 'Jessica' },
  trevor:   { email: 'trevor@stackwithus.com',       full_name: 'Trevor' },
  ryan:     { email: 'ryan@stackwithus.com',         full_name: 'Ryan' },
  nache:    { email: 'nn@stackstorage.us',           full_name: 'Nache' },
  james:    { email: 'jt@stackstorage.us',           full_name: 'James' },
  ean:      { email: 'ec@buildconstruction.co',      full_name: 'Ean' },
  jan:      { email: 'jan@stackwithus.com',          full_name: 'Jan' },
}

// People who can see / work across all buckets
export const CROSS_BUCKET_MEMBERS = [
  PEOPLE.kelson,
  PEOPLE.fernando,
]

// ── Bucket config ────────────────────────────────────────────────────────────

export const BUCKET_ROUTES = {
  operations: {
    label: 'Operations',
    entityNumbers: [
      { code: '4401', name: 'SOJO Station North' },
      { code: '4402', name: 'SOJO Station South' },
      { code: '2302', name: 'Cedar Hills Retail 2' },
      { code: '2303', name: 'Cedar Hills Retail 3' },
      { code: '4102', name: 'Victory Holdings / MFO' },
      { code: '4103', name: 'AREPIII / Younique' },
    ],
    entityPatterns: [],
    suggestedAssignee: PEOPLE.jen,
    members: [PEOPLE.jen],
  },
  buildco: {
    label: 'BuildCo',
    entityNumbers: [
      { code: '6400', name: 'BuildCo' },
    ],
    entityPatterns: [],
    suggestedAssignee: PEOPLE.ean,
    members: [PEOPLE.ean],
  },
  management: {
    label: 'Management',
    entityNumbers: [
      { code: '1002', name: 'Stack Management' },
    ],
    entityPatterns: [],
    suggestedAssignee: PEOPLE.andrew,
    members: [PEOPLE.andrew, PEOPLE.trevor],
  },
  farmington: {
    label: 'Farmington',
    entityNumbers: [
      { code: '3500', name: 'Farmington Holdings' },
    ],
    entityPatterns: [],
    suggestedAssignee: PEOPLE.ryan,
    members: [PEOPLE.ryan, PEOPLE.trevor],
  },
  tahoe: {
    label: 'Tahoe',
    entityNumbers: [
      { code: '6601', name: 'Lake Tahoe Partners' },
    ],
    entityPatterns: [],
    suggestedAssignee: PEOPLE.sharon,
    members: [PEOPLE.sharon],
  },
  storage: {
    label: 'Storage',
    // 3500-series storage entities. Farmington's exact 3500 is checked
    // first (exact > pattern), so it is not absorbed by this regex.
    // Add individual entity codes here as they are identified.
    entityNumbers: [],
    entityPatterns: [/^35\d\d$/],
    suggestedAssignee: PEOPLE.nache,
    members: [PEOPLE.nache, PEOPLE.james],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getInvoiceEntityNumber(invoice) {
  if (!invoice) return null
  const candidates = [
    invoice.entity_number,
    Array.isArray(invoice.gl_splits) ? invoice.gl_splits[0]?.entity_code : null,
    invoice.gl_code,
  ].filter(Boolean)

  for (const candidate of candidates) {
    const match = String(candidate).match(/(\d{4})/)
    if (match) return match[1]
  }
  return null
}

export function resolveBucket(invoice) {
  if (!invoice) return null

  if (invoice.portfolio_override && BUCKET_ROUTES[invoice.portfolio_override]) {
    const bucket = BUCKET_ROUTES[invoice.portfolio_override]
    return {
      portfolio_key: invoice.portfolio_override,
      portfolio_label: bucket.label,
      source: 'override',
      entity_number: null,
      entity_name: null,
      suggestedAssignee: bucket.suggestedAssignee || null,
      members: [...(bucket.members || []), ...CROSS_BUCKET_MEMBERS],
    }
  }

  const entityNumber = getInvoiceEntityNumber(invoice)
  if (entityNumber) {
    for (const [key, bucket] of Object.entries(BUCKET_ROUTES)) {
      const match = bucket.entityNumbers?.find(e => e.code === entityNumber)
      if (match) {
        return {
          portfolio_key: key,
          portfolio_label: bucket.label,
          source: 'entity',
          entity_number: match.code,
          entity_name: match.name,
          suggestedAssignee: bucket.suggestedAssignee || null,
          members: [...(bucket.members || []), ...CROSS_BUCKET_MEMBERS],
        }
      }
    }

    for (const [key, bucket] of Object.entries(BUCKET_ROUTES)) {
      if (bucket.entityPatterns?.some(re => re.test(entityNumber))) {
        return {
          portfolio_key: key,
          portfolio_label: bucket.label,
          source: 'entity-pattern',
          entity_number: entityNumber,
          entity_name: null,
          suggestedAssignee: bucket.suggestedAssignee || null,
          members: [...(bucket.members || []), ...CROSS_BUCKET_MEMBERS],
        }
      }
    }
  }

  return null
}

export function getInvoiceBucket(invoice) {
  return resolveBucket(invoice)
}

export function getSuggestedAssignee(invoice) {
  return resolveBucket(invoice)?.suggestedAssignee || null
}

export function getBucketMembers(invoice) {
  return resolveBucket(invoice)?.members || CROSS_BUCKET_MEMBERS
}
