/**
 * parsePdf.js
 *
 * Extracts text from a PDF File object using pdfjs-dist, then parses
 * structured invoice fields from the raw text using regex/heuristics.
 *
 * Works entirely in the browser — no server needed.
 */

import * as pdfjsLib from 'pdfjs-dist'

// Vite bundles the worker as a URL so we don't have to copy it manually
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

// ─── Text extraction ──────────────────────────────────────────────────────────

/**
 * Extract all text from a PDF File.
 * Returns { rawText, lines } where `lines` is text grouped by y-coordinate
 * (i.e. actual visual lines, not just arbitrary items).
 */
export async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const lineMap = new Map() // y (rounded) → [{x, str}]

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

  // Sort lines top-to-bottom (highest y first in PDF coords), left-to-right within line
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
  return { rawText, lines }
}

// ─── Field parsing ────────────────────────────────────────────────────────────

/**
 * Parse structured invoice fields from extracted text/lines.
 * Never returns wrong defaults — missing fields come back as null.
 */
export function parseInvoiceFields(rawText, lines) {
  console.debug('[parsePdf] raw text:\n', rawText)

  // ── Invoice number ─────────────────────────────────────────────────────────
  // Matches: "INVOICE # 8953", "INVOICE #8953", "Invoice No. 1234", "INV-001"
  // The # or No. marker is required so a standalone "INVOICE" heading doesn't false-match.
  const invoiceNumMatch = rawText.match(/INVOICE\s*#\s*(\w[\w\-]*)/i)
    || rawText.match(/INV(?:OICE)?\s*NO\.?\s*(\w[\w\-]*)/i)
  const invoiceNumber = invoiceNumMatch?.[1]?.trim() || null

  // ── Dates ──────────────────────────────────────────────────────────────────
  // Parse DUE DATE first, then find DATE that is NOT preceded by "DUE"
  const dueDateMatch = rawText.match(/DUE\s*DATE[:\s]+?([\d]{1,2}[\/\-][\d]{1,2}[\/\-][\d]{2,4})/i)
  const dueDate = dueDateMatch?.[1] ? normalizeDate(dueDateMatch[1]) : null

  // For invoice date: match "DATE" not preceded by "DUE". Use a simple approach:
  // find all "DATE <date>" occurrences, filter out the one that's part of "DUE DATE"
  let invoiceDate = null
  const datePattern = /(?:^|[\s])DATE[:\s]+?([\d]{1,2}[\/\-][\d]{1,2}[\/\-][\d]{2,4})/gim
  let dm
  while ((dm = datePattern.exec(rawText)) !== null) {
    // Check if "DUE" appears right before this match
    const prefix = rawText.slice(Math.max(0, dm.index - 5), dm.index)
    if (/DUE\s*$/i.test(prefix)) continue // skip "DUE DATE"
    invoiceDate = normalizeDate(dm[1])
    break
  }

  // ── Amount ─────────────────────────────────────────────────────────────────
  // Prefer BALANCE DUE → TOTAL DUE → TOTAL (most specific wins)
  const balanceDueMatch = rawText.match(/BALANCE\s+DUE\s+\$?\s*([\d,]+\.?\d*)/i)
  const totalDueMatch   = rawText.match(/TOTAL\s+DUE\s+\$?\s*([\d,]+\.?\d*)/i)
  const totalMatch      = rawText.match(/\bTOTAL\b\s+\$?\s*([\d,]+\.?\d*)/i)
  const amountStr = (
    balanceDueMatch?.[1] ||
    totalDueMatch?.[1]   ||
    totalMatch?.[1]      || ''
  ).replace(/,/g, '')
  const amount = amountStr ? parseFloat(amountStr) : null

  // ── Vendor name ────────────────────────────────────────────────────────────
  // Heuristic: first non-trivial line before the word "INVOICE"
  const invoiceLineIdx = lines.findIndex(l => /\bINVOICE\b/i.test(l))
  let vendorName = null
  for (let i = 0; i < Math.min(invoiceLineIdx > 0 ? invoiceLineIdx : 5, lines.length); i++) {
    const l = lines[i].trim()
    // Skip very short lines, pure numbers, or obvious header noise
    if (l.length > 3 && !/^\d+$/.test(l) && !/^(DATE|DUE|BILL|PAGE)/i.test(l)) {
      vendorName = l
      break
    }
  }

  // ── Bill To ────────────────────────────────────────────────────────────────
  const billToLineIdx = lines.findIndex(l => /BILL\s*TO/i.test(l))
  let billTo = null
  if (billToLineIdx >= 0) {
    for (let i = billToLineIdx + 1; i < Math.min(billToLineIdx + 4, lines.length); i++) {
      const candidate = lines[i].trim()
      if (
        candidate.length > 2 &&
        !/^(DESCRIPTION|QTY|UNIT|PRICE|SERVICE|DATE|DUE|INVOICE|AMOUNT)/i.test(candidate)
      ) {
        billTo = candidate
        break
      }
    }
  }

  // ── Property name ──────────────────────────────────────────────────────────
  // Extract from service description patterns:
  //   "Exterior Window Cleaning at SoJo North"
  //   "HVAC Service at MFO"
  //   "Landscaping of the Younique Building"
  let propertyName = null
  const propertyPatterns = [
    /\bat\s+([A-Z][A-Za-z0-9][A-Za-z0-9\s\-&']+?)(?:\s{2,}|\n|$)/,
    /\bof\s+the\s+([A-Z][A-Za-z0-9][A-Za-z0-9\s\-&']+?)(?:\s{2,}|\n|$)/,
    /\bfor\s+([A-Z][A-Za-z0-9][A-Za-z0-9\s\-&']+?)(?:\s{2,}|\n|$)/,
  ]
  for (const pattern of propertyPatterns) {
    const m = rawText.match(pattern)
    if (m?.[1]) {
      propertyName = m[1].trim().replace(/\s+/g, ' ')
      break
    }
  }

  // ── Line items ─────────────────────────────────────────────────────────────
  const lineItems = parseLineItems(lines)

  // ── Description ───────────────────────────────────────────────────────────
  // Use first line item description, or the line that yielded the property match
  const description = lineItems.length > 0 ? lineItems[0].description : null

  const parsed = {
    invoiceNumber,
    vendorName,
    billTo,
    propertyName,
    amount,
    invoiceDate,
    dueDate,
    lineItems,
    description,
    parseStatus: 'parsed',
  }

  console.debug('[parsePdf] parsed fields:', parsed)
  return parsed
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeDate(str) {
  // MM/DD/YYYY → YYYY-MM-DD
  const mmddyyyy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mmddyyyy) {
    const [, m, d, y] = mmddyyyy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // DD-MM-YYYY or YYYY-MM-DD → leave as-is if already ISO
  return str
}

function parseLineItems(lines) {
  // Find header row containing DESCRIPTION and (QTY or QUANTITY)
  const headerIdx = lines.findIndex(
    l => /DESCRIPTION/i.test(l) && /QTY|QUANTITY/i.test(l)
  )
  // Find end marker (SUBTOTAL or standalone TOTAL)
  const endIdx = lines.findIndex(
    (l, i) => i > (headerIdx >= 0 ? headerIdx : 0) && /^(SUBTOTAL|TOTAL)\b/i.test(l.trim())
  )

  if (headerIdx < 0) return []

  const end = endIdx > headerIdx ? endIdx : lines.length
  const itemLines = lines.slice(headerIdx + 1, end)
  const items = []

  for (const line of itemLines) {
    if (!line.trim()) continue

    // Full match: "Description text    1    3,695.00    3,695.00"
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

    // Partial match: line ending in a dollar amount, treat as lump-sum item
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

// ─── Convenience: extract + parse in one call ─────────────────────────────────

export async function parsePdfInvoice(file) {
  const { rawText, lines } = await extractPdfText(file)
  const fields = parseInvoiceFields(rawText, lines)
  return { rawText, ...fields }
}
