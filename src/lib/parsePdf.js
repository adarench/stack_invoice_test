/**
 * parsePdf.js
 *
 * Extracts text from a PDF File object using pdfjs-dist, then parses
 * structured invoice fields from the raw text using regex/heuristics.
 *
 * Works entirely in the browser — no server needed.
 */
let pdfjsLibPromise = null

async function getPdfjsLib() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist').then(mod => {
      mod.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).href
      return mod
    })
  }
  return pdfjsLibPromise
}

function clampConfidence(value) {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return Number(value.toFixed(3))
}

function buildExtractionMetadata(rawText, lines, pageCount) {
  const safeRawText = typeof rawText === 'string' ? rawText : ''
  const safeLines = Array.isArray(lines) ? lines : []
  const rawTextLength = safeRawText.trim().length
  const lineCount = safeLines.length
  const visibleCharCount = safeRawText.replace(/\s+/g, '').length
  const hasUsableText = rawTextLength >= 80 && lineCount >= 3

  return {
    pageCount,
    lineCount,
    rawTextLength,
    rawTextPreview: safeRawText.slice(0, 2000),
    visibleCharCount,
    hasUsableText,
    textLikelyMissing: !hasUsableText,
  }
}

function calculateParseConfidence(fields, extraction) {
  let score = 0

  if (fields.vendorName) score += 0.22
  if (fields.amount != null) score += 0.24
  if (fields.invoiceNumber) score += 0.16
  if (fields.invoiceDate) score += 0.1
  if (fields.dueDate) score += 0.06
  if (fields.propertyName) score += 0.1
  if (fields.billTo) score += 0.05
  if (Array.isArray(fields.lineItems) && fields.lineItems.length > 0) score += 0.07

  if (extraction?.hasUsableText) score += 0.05
  if ((extraction?.rawTextLength || 0) < 40) score -= 0.2
  if ((extraction?.lineCount || 0) < 2) score -= 0.1

  return clampConfidence(score)
}

// ─── Text extraction ──────────────────────────────────────────────────────────

export async function extractPdfText(file) {
  const pdfjsLib = await getPdfjsLib()
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const lineMap = new Map()

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()
    for (const item of content.items) {
      const str = item.str
      if (!str || !str.trim()) continue
      const y = Math.round(item.transform[5])
      const x = item.transform[4]
      if (!lineMap.has(y)) lineMap.set(y, [])
      lineMap.get(y).push({ x, str })
    }
  }

  const sortedYs = [...lineMap.keys()].sort((a, b) => b - a)
  const lines = sortedYs
    .map(y =>
      lineMap
        .get(y)
        .sort((a, b) => a.x - b.x)
        .map(i => i.str)
        .join(' ')
        .trim()
    )
    .filter(Boolean)

  const rawText = lines.join('\n')
  return { rawText, lines, pageCount: pdf.numPages }
}

// ─── Field parsing ────────────────────────────────────────────────────────────

export function parseInvoiceFields(rawText, lines, extraction = null) {
  console.debug('[parsePdf] raw text:\n', rawText)
  console.debug('[parsePdf] lines (' + lines.length + '):', lines)

  const invoiceNumber = parseInvoiceNumber(rawText)
  const { invoiceDate, dueDate } = parseDates(rawText)
  const amount = parseAmount(rawText)
  const vendorName = parseVendorName(rawText, lines)
  const billTo = parseBillTo(lines)
  const { propertyName, serviceLocation } = parseLocationFields(rawText, lines)
  const lineItems = parseLineItems(lines)
  const description = lineItems.length > 0 ? lineItems[0].description : null
  const extractionMetadata = extraction || buildExtractionMetadata(rawText, lines, 0)

  const parsed = {
    invoiceNumber,
    vendorName,
    billTo,
    propertyName,
    serviceLocation,
    amount,
    invoiceDate,
    dueDate,
    lineItems,
    description,
    parseStatus: 'parsed',
    parseMethod: 'text',
    parseConfidence: calculateParseConfidence({
      vendorName,
      invoiceNumber,
      billTo,
      propertyName,
      serviceLocation,
      amount,
      invoiceDate,
      dueDate,
      lineItems,
    }, extractionMetadata),
    extraction: extractionMetadata,
  }

  console.debug('[parsePdf] parsed fields:', parsed)
  return parsed
}

// ─── Invoice number ──────────────────────────────────────────────────────────

function parseInvoiceNumber(rawText) {
  const patterns = [
    /INVOICE\s*#\s*(\w[\w\-]*)/i,
    /INV(?:OICE)?\s*NO\.?\s*:?\s*(\w[\w\-]*)/i,
    /INVOICE\s*NUMBER\s*:?\s*(\w[\w\-]*)/i,
    /INV\s*#\s*(\w[\w\-]*)/i,
    /REFERENCE\s*#?\s*:?\s*(\w[\w\-]*)/i,
    /INVOICE\s*:?\s+(\d[\w\-]+)/i,
    /NUMBER\s*:?\s*(\d[\w\-]+)/i,
  ]
  for (const re of patterns) {
    const m = rawText.match(re)
    if (m?.[1]?.trim()) return m[1].trim()
  }
  return null
}

// ─── Dates ───────────────────────────────────────────────────────────────────

const DATE_VALUE = String.raw`(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})`
const MONTH_DATE = String.raw`((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4})`
const ANY_DATE = `(?:${DATE_VALUE}|${MONTH_DATE})`

function parseDates(rawText) {
  let dueDate = null
  let invoiceDate = null

  const duePatterns = [
    new RegExp(`DUE\\s*DATE[:\\s]+?${ANY_DATE}`, 'i'),
    new RegExp(`PAYMENT\\s*DUE[:\\s]+?${ANY_DATE}`, 'i'),
    new RegExp(`DUE[:\\s]+?${ANY_DATE}`, 'i'),
    new RegExp(`PAY\\s*BY[:\\s]+?${ANY_DATE}`, 'i'),
  ]
  for (const re of duePatterns) {
    const m = rawText.match(re)
    const raw = m?.[1] || m?.[2]
    if (raw) { dueDate = normalizeDate(raw); break }
  }

  const datePatterns = [
    new RegExp(`INVOICE\\s*DATE[:\\s]+?${ANY_DATE}`, 'i'),
    new RegExp(`(?:^|[\\s])DATE[:\\s]+?${ANY_DATE}`, 'im'),
    new RegExp(`DATED?[:\\s]+?${ANY_DATE}`, 'i'),
    new RegExp(`ISSUED?[:\\s]+?${ANY_DATE}`, 'i'),
  ]
  for (const re of datePatterns) {
    const m = rawText.match(re)
    const raw = m?.[1] || m?.[2]
    if (raw) {
      const d = normalizeDate(raw)
      if (d !== dueDate) { invoiceDate = d; break }
    }
  }

  return { invoiceDate, dueDate }
}

// ─── Amount ──────────────────────────────────────────────────────────────────

const MONEY = String.raw`\$?\s*([\d,]+\.?\d{0,2})`

function parseAmount(rawText) {
  const labeledPatterns = [
    new RegExp(`BALANCE\\s*DUE\\s*:?\\s*${MONEY}`, 'i'),
    new RegExp(`AMOUNT\\s*DUE\\s*:?\\s*${MONEY}`, 'i'),
    new RegExp(`TOTAL\\s*DUE\\s*:?\\s*${MONEY}`, 'i'),
    new RegExp(`TOTAL\\s*AMOUNT\\s*:?\\s*${MONEY}`, 'i'),
    new RegExp(`NET\\s*AMOUNT\\s*:?\\s*${MONEY}`, 'i'),
    new RegExp(`NET\\s*TOTAL\\s*:?\\s*${MONEY}`, 'i'),
    new RegExp(`INVOICE\\s*TOTAL\\s*:?\\s*${MONEY}`, 'i'),
    new RegExp(`GRAND\\s*TOTAL\\s*:?\\s*${MONEY}`, 'i'),
    new RegExp(`CONTRACT\\s*(?:AMOUNT|TOTAL|VALUE)\\s*:?\\s*${MONEY}`, 'i'),
    new RegExp(`(?:SUB)?\\s*TOTAL\\s*:?\\s*${MONEY}`, 'i'),
    new RegExp(`AMOUNT\\s*:?\\s*${MONEY}`, 'i'),
  ]
  for (const re of labeledPatterns) {
    const m = rawText.match(re)
    if (m?.[1]) {
      const v = parseFloat(m[1].replace(/,/g, ''))
      if (Number.isFinite(v) && v > 0) return v
    }
  }

  // Fallback: find all dollar amounts in the document, take the largest
  const allAmounts = []
  const dollarRe = /\$\s*([\d,]+\.\d{2})/g
  let dm
  while ((dm = dollarRe.exec(rawText)) !== null) {
    const v = parseFloat(dm[1].replace(/,/g, ''))
    if (Number.isFinite(v) && v > 0) allAmounts.push(v)
  }
  if (allAmounts.length > 0) {
    return Math.max(...allAmounts)
  }

  return null
}

// ─── Vendor name ─────────────────────────────────────────────────────────────

function parseVendorName(rawText, lines) {
  // Strategy 1: first non-trivial line before "INVOICE" keyword
  const invoiceLineIdx = lines.findIndex(l => /\bINVOICE\b/i.test(l))
  const searchLimit = invoiceLineIdx > 0 ? invoiceLineIdx : Math.min(8, lines.length)

  for (let i = 0; i < searchLimit; i++) {
    const l = lines[i].trim()
    if (isViableVendorLine(l)) return cleanVendorName(l)
  }

  // Strategy 2: look for "FROM:" or "BILL FROM:" or "VENDOR:" label
  const fromPatterns = [
    /(?:BILL\s*FROM|FROM|VENDOR|SOLD\s*BY|COMPANY)\s*:?\s*(.+)/im,
  ]
  for (const re of fromPatterns) {
    const m = rawText.match(re)
    if (m?.[1]?.trim() && isViableVendorLine(m[1].trim())) {
      return cleanVendorName(m[1].trim())
    }
  }

  // Strategy 3: just use the first non-trivial line of the document
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const l = lines[i].trim()
    if (l.length > 2 && !/^\d+$/.test(l)) return cleanVendorName(l)
  }

  return null
}

function isViableVendorLine(line) {
  if (!line || line.length < 3) return false
  if (/^\d+$/.test(line)) return false
  if (/^(DATE|DUE|BILL\s*TO|PAGE|DESCRIPTION|QTY|AMOUNT|TOTAL|TERMS)/i.test(line)) return false
  if (/^(PO\s*BOX|PHONE|FAX|EMAIL|WWW\.|HTTP)/i.test(line)) return false
  return true
}

function cleanVendorName(name) {
  return name
    .replace(/\s*(INVOICE|INV\b|#\d+).*/i, '')
    .replace(/[,\s]+$/, '')
    .trim() || null
}

// ─── Bill To ─────────────────────────────────────────────────────────────────

function parseBillTo(lines) {
  const idx = lines.findIndex(l => /BILL\s*TO|SHIP\s*TO|SOLD\s*TO|CUSTOMER/i.test(l))
  if (idx < 0) return null

  for (let i = idx + 1; i < Math.min(idx + 4, lines.length); i++) {
    const c = lines[i].trim()
    if (c.length > 2 && !/^(DESCRIPTION|QTY|UNIT|PRICE|SERVICE|DATE|DUE|INVOICE|AMOUNT|TERMS)/i.test(c)) {
      return c
    }
  }
  return null
}

function normalizeLocationValue(value) {
  if (!value || typeof value !== 'string') return null
  const normalized = value
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s*-\s*$/, '')
    .trim()

  return normalized.length > 2 ? normalized : null
}

function parseServiceLocation(lines) {
  const labelPattern = /(?:SERVICE|JOB)\s*(?:LOCATION|ADDRESS|SITE)|(?:LOCATION|SITE)|ADDRESS/i
  const stopPattern = /^(?:SCOPE|TERMS|DATE|INVOICE|BILL|TAX|FOR|ACTIVITY|AMOUNT|SUBTOTAL|TOTAL|BALANCE|THANK|MAKE\s+ALL|PAYMENT)/i

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (!labelPattern.test(line)) continue

    const segments = []
    const inlineValue = line.split(/:\s*/).slice(1).join(': ').trim()
    if (inlineValue) segments.push(inlineValue)

    for (let next = index + 1; next < Math.min(index + 5, lines.length); next++) {
      const candidate = lines[next].trim()
      if (!candidate) continue
      if (stopPattern.test(candidate)) break
      if (/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}$/i.test(candidate)) break
      segments.push(candidate)
    }

    const normalized = normalizeLocationValue(segments.join(' '))
    if (normalized) return normalized
  }

  return null
}

// ─── Property name / service location ───────────────────────────────────────

function parseLocationFields(rawText, lines) {
  // Labeled patterns first
  const labeled = [
    /(?:SERVICE|JOB)\s*(?:LOCATION|ADDRESS|SITE)\s*:?\s*(.+)/im,
    /(?:PROJECT|PROPERTY)\s*(?:NAME|SITE)?\s*:?\s*(.+)/im,
    /(?:LOCATION|SITE)\s*:?\s*(.+)/im,
  ]

  let propertyName = null
  for (const re of labeled) {
    const m = rawText.match(re)
    const normalized = normalizeLocationValue(m?.[1])
    if (normalized) {
      propertyName = normalized
      break
    }
  }

  const serviceLocation = parseServiceLocation(lines)

  if (!propertyName) {
    const addressIndex = lines.findIndex(line => /ADDRESS\s*:/i.test(line))
    if (addressIndex > 0) {
      const candidates = []
      for (let index = addressIndex - 1; index >= 0 && candidates.length < 2; index--) {
        const candidate = lines[index].trim()
        if (!candidate) continue
        if (/^(?:DATE|ACTIVITY|AMOUNT|SERVICES?|SCOPE|TERMS|INVOICE|BILL\s*TO|TAX\s*ID|FOR:?)\b/i.test(candidate)) continue
        if (/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}$/i.test(candidate)) continue
        if (/^\$?[\d,]+(?:\.\d{2})?$/.test(candidate)) continue
        candidates.unshift(candidate)
      }

      propertyName = normalizeLocationValue(candidates.join(' '))
    }
  }

  if (!propertyName) {
    // Heuristic: "at <Property>", "for <Property>", etc.
    const heuristics = [
      /\bat\s+([A-Z][A-Za-z0-9][A-Za-z0-9\s\-&']+?)(?:\s{2,}|\n|$)/,
      /\bof\s+the\s+([A-Z][A-Za-z0-9][A-Za-z0-9\s\-&']+?)(?:\s{2,}|\n|$)/,
      /\bfor\s+([A-Z][A-Za-z0-9][A-Za-z0-9\s\-&']+?)(?:\s{2,}|\n|$)/,
    ]
    for (const re of heuristics) {
      const normalized = normalizeLocationValue(rawText.match(re)?.[1])
      if (normalized) {
        propertyName = normalized
        break
      }
    }
  }

  return { propertyName, serviceLocation }
}

// ─── Line items ──────────────────────────────────────────────────────────────

function parseLineItems(lines) {
  const headerIdx = lines.findIndex(
    l => /DESCRIPTION/i.test(l) && /QTY|QUANTITY|AMOUNT|PRICE|RATE/i.test(l)
  )
  const endIdx = lines.findIndex(
    (l, i) => i > (headerIdx >= 0 ? headerIdx : 0) && /^(SUBTOTAL|TOTAL|BALANCE|AMOUNT\s*DUE)\b/i.test(l.trim())
  )

  if (headerIdx < 0) return []

  const end = endIdx > headerIdx ? endIdx : lines.length
  const itemLines = lines.slice(headerIdx + 1, end)
  const items = []

  for (const line of itemLines) {
    if (!line.trim()) continue

    const full = line.match(
      /^(.+?)\s{2,}(\d+(?:\.\d+)?)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)$/
    )
    if (full) {
      items.push({
        description: full[1].trim(),
        qty: parseFloat(full[2]),
        unit_price: parseFloat(full[3].replace(/,/g, '')),
        total: parseFloat(full[4].replace(/,/g, '')),
      })
      continue
    }

    const partial = line.match(/^(.+?)\s+\$?([\d,]+\.\d{2})$/)
    if (partial) {
      const total = parseFloat(partial[2].replace(/,/g, ''))
      if (total > 0) {
        items.push({
          description: partial[1].trim(),
          qty: 1,
          unit_price: total,
          total,
        })
      }
    }
  }

  return items
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeDate(str) {
  // "January 15, 2025" or "Jan 15, 2025"
  const monthName = str.match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/)
  if (monthName) {
    const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' }
    const mKey = monthName[1].slice(0, 3).toLowerCase()
    const m = months[mKey]
    if (m) return `${monthName[3]}-${m}-${monthName[2].padStart(2, '0')}`
  }

  // MM/DD/YYYY or MM-DD-YYYY or MM.DD.YYYY
  const mmddyyyy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/)
  if (mmddyyyy) {
    const [, m, d, y] = mmddyyyy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // MM/DD/YY
  const mmddyy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/)
  if (mmddyy) {
    const [, m, d, y] = mmddyy
    const fullYear = parseInt(y) > 50 ? `19${y}` : `20${y}`
    return `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  return str
}

// ─── Convenience: extract + parse in one call ────────────────────────────────

export async function parsePdfInvoice(file) {
  const { rawText, lines, pageCount } = await extractPdfText(file)
  const extraction = buildExtractionMetadata(rawText, lines, pageCount)
  const fields = parseInvoiceFields(rawText, lines, extraction)
  return { rawText, ...fields }
}
