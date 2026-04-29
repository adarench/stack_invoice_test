function normalizePropertyValue(value) {
  if (value == null) return ''
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenizePropertyValue(value) {
  return normalizePropertyValue(value)
    .split(' ')
    .filter(token => token.length > 1)
}

function bigramDiceScore(left, right) {
  const source = normalizePropertyValue(left).replace(/\s+/g, '')
  const target = normalizePropertyValue(right).replace(/\s+/g, '')

  if (!source || !target) return 0
  if (source === target) return 1
  if (source.length < 2 || target.length < 2) return 0

  const sourceBigrams = []
  for (let index = 0; index < source.length - 1; index += 1) {
    sourceBigrams.push(source.slice(index, index + 2))
  }

  const targetCounts = new Map()
  for (let index = 0; index < target.length - 1; index += 1) {
    const bigram = target.slice(index, index + 2)
    targetCounts.set(bigram, (targetCounts.get(bigram) || 0) + 1)
  }

  let intersection = 0
  for (const bigram of sourceBigrams) {
    const remaining = targetCounts.get(bigram) || 0
    if (remaining > 0) {
      intersection += 1
      targetCounts.set(bigram, remaining - 1)
    }
  }

  return (2 * intersection) / (sourceBigrams.length + (target.length - 1))
}

export const UNMAPPED_PROPERTY_VALUE = '__unmapped__'

export const PROPERTY_CATALOG = [
  {
    property_name: 'SOJO Station North',
    aliases: ['SoJo North', 'SOJO North', 'SOJO Station N', 'Station North'],
    property_codes: ['4401'],
    portfolio_key: 'operations',
    portfolio_label: 'Operations',
    entity_code: '4401',
    entity_name: 'SOJO Station North',
  },
  {
    property_name: 'SOJO Station South',
    aliases: ['SoJo South', 'SOJO South', 'SOJO Station S', 'Station South'],
    property_codes: ['4402'],
    portfolio_key: 'operations',
    portfolio_label: 'Operations',
    entity_code: '4402',
    entity_name: 'SOJO Station South',
  },
  {
    property_name: 'Cedar Hills Retail',
    aliases: ['Cedar Hills Retail 2', 'Cedar Hills Retail 3', 'Cedar Hills'],
    property_codes: ['2302', '2303'],
    portfolio_key: 'operations',
    portfolio_label: 'Operations',
    entity_code: '2302',
    entity_name: 'Cedar Hills Retail 2',
  },
  {
    property_name: 'Victory Holdings',
    aliases: ['Victory Holdings / MFO', 'MFO'],
    property_codes: ['4102'],
    portfolio_key: 'operations',
    portfolio_label: 'Operations',
    entity_code: '4102',
    entity_name: 'Victory Holdings / MFO',
  },
  {
    property_name: 'Younique',
    aliases: ['AREPIII / Younique', 'Younique HQ', 'Younique Maxfield Family Offices HQ', 'Maxfield Family Offices HQ'],
    property_codes: ['4103'],
    portfolio_key: 'operations',
    portfolio_label: 'Operations',
    entity_code: '4103',
    entity_name: 'AREPIII / Younique',
  },
  {
    property_name: 'Stack Storage',
    aliases: ['Storage', 'Stack Storage Portfolio'],
    property_codes: ['3501', '3502', '3503'],
    portfolio_key: 'storage',
    portfolio_label: 'Storage',
    entity_code: '3501',
    entity_name: 'Stack Storage',
  },
  {
    property_name: 'Lake Tahoe Partners',
    aliases: ['Tahoe', 'Tahoe Portfolio', 'Lake Tahoe'],
    property_codes: ['6601'],
    portfolio_key: 'tahoe',
    portfolio_label: 'Tahoe',
    entity_code: '6601',
    entity_name: 'Lake Tahoe Partners',
  },
  {
    property_name: 'Stack Management',
    aliases: ['Management', 'Management Portfolio'],
    property_codes: ['1002'],
    portfolio_key: 'management',
    portfolio_label: 'Management',
    entity_code: '1002',
    entity_name: 'Stack Management',
  },
  {
    property_name: 'Farmington Holdings',
    aliases: ['Farmington'],
    property_codes: ['3500'],
    portfolio_key: 'farmington',
    portfolio_label: 'Farmington',
    entity_code: '3500',
    entity_name: 'Farmington Holdings',
  },
  {
    property_name: 'BuildCo',
    aliases: ['Build Co', 'Build Company'],
    property_codes: ['6400'],
    portfolio_key: 'buildco',
    portfolio_label: 'BuildCo',
    entity_code: '6400',
    entity_name: 'BuildCo',
  },
]

export const DEFAULT_PORTFOLIO = {
  portfolio_key: 'unmapped',
  portfolio_label: 'Unmapped',
  entity_code: '',
  entity_name: '',
}

function propertyCandidates(entry) {
  return [
    entry.property_name,
    entry.entity_name,
    entry.entity_code,
    ...(Array.isArray(entry.aliases) ? entry.aliases : []),
    ...(Array.isArray(entry.property_codes) ? entry.property_codes : []),
  ]
    .map(normalizePropertyValue)
    .filter(Boolean)
}

export function getPropertyDisplayLabel(entry) {
  if (!entry) return ''
  const details = [entry.entity_code, entry.portfolio_label].filter(Boolean).join(' - ')
  return details ? `${entry.property_name} (${details})` : entry.property_name
}

export const PROPERTY_OPTIONS = PROPERTY_CATALOG.map(entry => ({
  value: entry.property_name,
  label: getPropertyDisplayLabel(entry),
  entry,
}))

export const PORTFOLIO_OPTIONS = PROPERTY_CATALOG
  .filter((entry, index, rows) => rows.findIndex(row => row.portfolio_key === entry.portfolio_key) === index)
  .map(entry => ({
    value: entry.portfolio_key,
    label: entry.portfolio_label,
  }))

export function findPropertyCatalogEntry(value) {
  const normalized = normalizePropertyValue(value)
  if (!normalized) return null
  const normalizedTokenCount = tokenizePropertyValue(normalized).length

  const exactMatch = PROPERTY_CATALOG.find(entry =>
    propertyCandidates(entry).some(candidate => candidate === normalized)
  )
  if (exactMatch) return exactMatch

  const inclusiveMatches = PROPERTY_CATALOG.filter(entry =>
    propertyCandidates(entry).some(candidate =>
      candidate.length >= 6 && (
        normalized.includes(candidate) ||
        (normalizedTokenCount >= 2 && candidate.includes(normalized))
      )
    )
  )
  if (inclusiveMatches.length === 1) return inclusiveMatches[0]

  return null
}

export function suggestPropertyCatalogEntry(value) {
  const normalized = normalizePropertyValue(value)
  if (!normalized) return null

  const existingMatch = findPropertyCatalogEntry(normalized)
  if (existingMatch) return existingMatch

  const sourceTokens = tokenizePropertyValue(normalized)
  if (sourceTokens.length === 0) return null

  const scored = PROPERTY_CATALOG.map(entry => {
    const score = propertyCandidates(entry).reduce((bestScore, candidate) => {
      const candidateTokens = tokenizePropertyValue(candidate)
      const sharedTokenCount = candidateTokens.filter(token => sourceTokens.includes(token)).length
      const overlapScore = sharedTokenCount / Math.max(sourceTokens.length, candidateTokens.length || 1)
      const prefixBonus = candidate.startsWith(normalized) || normalized.startsWith(candidate) ? 0.18 : 0
      const substringBonus = candidate.includes(normalized) || normalized.includes(candidate) ? 0.12 : 0
      const textSimilarity = bigramDiceScore(normalized, candidate) * 0.55
      return Math.max(bestScore, overlapScore + prefixBonus + substringBonus + textSimilarity)
    }, 0)

    return { entry, score }
  })
    .sort((a, b) => b.score - a.score)

  const best = scored[0]
  const runnerUp = scored[1]
  if (!best || best.score < 0.58) return null
  if (runnerUp && best.score - runnerUp.score < 0.05) return null

  return best.entry
}

export function canonicalizePropertyName(value) {
  const match = findPropertyCatalogEntry(value)
  return match?.property_name || (typeof value === 'string' ? value.trim() : '')
}

export function propertyMatchesCatalog(value) {
  return !!findPropertyCatalogEntry(value)
}
