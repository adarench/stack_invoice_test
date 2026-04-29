import { parsePdfInvoice } from './parsePdf.js'
import { invokeInvoiceParseFallback } from '../api/parseApi'
import { classifyGLCode } from '../api/glClassifyApi'
import { canonicalizePropertyName } from '../data/propertyCatalog'
import { findGlAccount, normalizeGlCode } from '../data/chartOfAccounts'
import { resolvePortfolio } from './invoiceAccounting'

function coerceString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function coerceOptionalNumber(value) {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function coerceOptionalDate(value) {
  const normalized = coerceString(value)
  if (!normalized) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized

  const monthName = normalized.match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/)
  if (monthName) {
    const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' }
    const month = months[monthName[1].slice(0, 3).toLowerCase()]
    if (month) return `${monthName[3]}-${month}-${monthName[2].padStart(2, '0')}`
  }

  const mmddyyyy = normalized.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/)
  if (mmddyyyy) {
    const [, month, day, year] = mmddyyyy
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const mmddyy = normalized.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/)
  if (mmddyy) {
    const [, month, day, year] = mmddyy
    const fullYear = parseInt(year, 10) > 50 ? `19${year}` : `20${year}`
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  return normalized
}

function clampConfidence(value) {
  if (!Number.isFinite(value)) return null
  if (value < 0) return 0
  if (value > 1) return 1
  return Number(value.toFixed(3))
}

function normalizeLineItems(lineItems) {
  if (!Array.isArray(lineItems)) return []

  return lineItems
    .map(item => ({
      description: coerceString(item?.description),
      qty: coerceOptionalNumber(item?.qty),
      unit_price: coerceOptionalNumber(item?.unit_price),
      total: coerceOptionalNumber(item?.total),
    }))
    .filter(item => item.description || item.total != null || item.unit_price != null || item.qty != null)
}

function mergeNotes(...notes) {
  const merged = notes
    .map(note => coerceString(note))
    .filter(Boolean)
    .filter((note, index, values) => values.indexOf(note) === index)
  return merged.length > 0 ? merged.join(' | ') : null
}

function normalizeFallbackParsed(fallback) {
  if (!fallback || typeof fallback !== 'object') return null

  return {
    vendorName: coerceString(fallback.vendor_name),
    invoiceNumber: coerceString(fallback.invoice_number),
    amount: coerceOptionalNumber(fallback.amount),
    invoiceDate: coerceOptionalDate(fallback.invoice_date),
    dueDate: coerceOptionalDate(fallback.due_date),
    propertyName: coerceString(fallback.property_name || fallback.service_location),
    serviceLocation: coerceString(fallback.service_location),
    billTo: coerceString(fallback.bill_to_name),
    description: coerceString(fallback.description),
    lineItems: normalizeLineItems(fallback.line_items),
    extractedGlCode: coerceString(fallback.extracted_gl_code) || null,
    extractedGlSource: coerceString(fallback.extracted_gl_source) || null,
    extractedGlConfidence: typeof fallback.extracted_gl_confidence === 'number'
      ? clampConfidence(fallback.extracted_gl_confidence)
      : null,
    rawText: null,
    parseMethod: typeof fallback.parse_method === 'string' ? fallback.parse_method : 'llm_pdf',
    parseConfidence: clampConfidence(
      typeof fallback.confidence === 'number'
        ? fallback.confidence
        : typeof fallback.parse_confidence === 'number'
          ? fallback.parse_confidence
          : 0.65
    ),
    parseNotes: mergeNotes(fallback.notes, fallback.warning),
    extraction: {
      rawTextLength: 0,
      rawTextPreview: '',
      lineCount: 0,
      pageCount: fallback.page_count ?? null,
      hasUsableText: false,
      textLikelyMissing: true,
    },
    parseMetadata: {
      fallbackModel: fallback.model || null,
      fallbackReason: fallback.reason || null,
      fallbackNotes: fallback.notes || null,
      fallbackWarning: fallback.warning || null,
      rawResponsePreview: coerceString(fallback.raw_response_preview).slice(0, 500) || null,
    },
  }
}

function mergeParsedResults(primary, fallback) {
  if (!fallback) return primary
  if (!primary) return fallback

  const mergedLineItems = normalizeLineItems(
    fallback.lineItems.length > 0 ? fallback.lineItems : primary.lineItems
  )

  const rawText = primary.rawText || null
  const rawTextLength = primary.extraction?.rawTextLength ?? 0
  const combinedMethod = primary.parseMethod === 'text'
    ? (rawTextLength > 0 ? 'text+llm_pdf' : fallback.parseMethod)
    : (fallback.parseMethod || primary.parseMethod || 'llm_pdf')

  return {
    ...primary,
    vendorName: primary.vendorName || fallback.vendorName,
    invoiceNumber: primary.invoiceNumber || fallback.invoiceNumber,
    amount: primary.amount ?? fallback.amount ?? null,
    invoiceDate: primary.invoiceDate || fallback.invoiceDate,
    dueDate: primary.dueDate || fallback.dueDate,
    propertyName: primary.propertyName || fallback.propertyName || fallback.serviceLocation,
    serviceLocation: primary.serviceLocation || fallback.serviceLocation,
    billTo: primary.billTo || fallback.billTo,
    description: primary.description || fallback.description,
    lineItems: mergedLineItems,
    extractedGlCode: primary.extractedGlCode || fallback.extractedGlCode || null,
    extractedGlSource: primary.extractedGlSource || fallback.extractedGlSource || null,
    extractedGlConfidence: primary.extractedGlConfidence ?? fallback.extractedGlConfidence ?? null,
    rawText,
    parseMethod: combinedMethod,
    parseConfidence: clampConfidence(Math.max(primary.parseConfidence ?? 0, fallback.parseConfidence ?? 0)),
    parseNotes: mergeNotes(primary.parseNotes, fallback.parseNotes),
    extraction: {
      ...(primary.extraction || {}),
      fallbackUsed: true,
      fallbackMethod: fallback.parseMethod || 'llm_pdf',
    },
    parseMetadata: {
      ...(primary.parseMetadata || {}),
      ...(fallback.parseMetadata || {}),
      fallbackUsed: true,
      fallbackMethod: fallback.parseMethod || 'llm_pdf',
    },
  }
}

function countParsedFields(parsed) {
  if (!parsed) return 0

  const candidates = [
    parsed.vendorName,
    parsed.invoiceNumber,
    parsed.propertyName,
    parsed.amount,
    parsed.invoiceDate,
    parsed.dueDate,
    parsed.billTo,
    parsed.description,
    Array.isArray(parsed.lineItems) && parsed.lineItems.length > 0 ? parsed.lineItems : null,
  ]

  return candidates.filter(value => {
    if (Array.isArray(value)) return value.length > 0
    return value != null && value !== ''
  }).length
}

function resolveParseStatus(parsed, parseError) {
  if (!parsed) return 'manual'

  const confidence = clampConfidence(parsed.parseConfidence ?? 0)
  const parsedCount = countParsedFields(parsed)
  if (parseError) return parsedCount > 0 ? 'partial' : 'failed'
  if (parsedCount >= 4 && (confidence == null || confidence >= 0.7)) return 'parsed'
  if (parsedCount > 0) return 'partial'
  if (parsed?.parseMetadata?.fallbackUsed) return 'failed'
  return 'manual'
}

// Resolve a raw extracted GL code (e.g. "5416", "5416-00", "5416.00") against
// the chart of accounts. Returns the normalized code plus a resolved flag —
// resolved=false means we keep the candidate code but flag it as needing a
// chart match, so it can render as "Suggested: 5416 — needs chart match"
// instead of being silently dropped.
function resolveExtractedGl(rawCode) {
  if (!rawCode) return null
  const raw = String(rawCode).trim()
  if (!raw) return null
  const normalized = normalizeGlCode(raw)
  const account = findGlAccount(normalized)
  return {
    raw,
    normalized,
    resolved: !!account,
    account: account || null,
  }
}

// Pipeline gate: when do we ask Anthropic to suggest a GL code?
// Skip when the parser already extracted a code visible on the invoice with
// reasonable confidence — no point asking the model to guess when we have an
// answer. We still classify when extraction is missing or low-confidence.
function shouldClassifyGlCode(parsed, invoiceData, extraction) {
  if (invoiceData?.gl_code) return false
  if (extraction?.resolved && (extraction.confidence ?? 1) >= 0.7) return false
  return true
}

const HIGH_CONFIDENCE_GL_THRESHOLD = 0.75

function attachGlSuggestion(draft, suggestion) {
  if (!suggestion) return draft

  const suggestedCode = suggestion.suggested_gl_code || null
  const account = suggestedCode ? findGlAccount(suggestedCode) : null
  const validInChart = !!account && !suggestion.hallucinated_code
  const confidence = clampConfidence(suggestion.confidence ?? null) ?? 0

  const glSuggestion = suggestedCode
    ? {
        code: suggestedCode,
        description: suggestion.suggested_gl_description || account?.name || null,
        confidence,
        reasoning: suggestion.reasoning || '',
        model: suggestion.model || null,
        source: 'anthropic',
        valid_in_chart: validInChart,
        hallucinated: !!suggestion.hallucinated_code,
      }
    : null

  // Promote to gl_splits when classifier returned a high-confidence valid code
  // and the parser didn't already seed splits from extraction.
  const existingSplits = Array.isArray(draft.invoiceData.gl_splits) ? draft.invoiceData.gl_splits : []
  const splitsEmpty = existingSplits.length === 0
  const amount = draft.invoiceData.amount
  let nextSplits = existingSplits
  let promoted = false

  if (
    glSuggestion &&
    validInChart &&
    confidence >= HIGH_CONFIDENCE_GL_THRESHOLD &&
    splitsEmpty &&
    amount != null
  ) {
    const portfolio = resolvePortfolio(draft.invoiceData.property_name)
    nextSplits = [{
      entity_code: portfolio.entity_code || '',
      entity_name: portfolio.entity_name || '',
      gl_code: account.code,
      amount: Number(amount),
      description: account.name || draft.invoiceData.description || 'AI-suggested allocation',
    }]
    promoted = true
  }

  const promotionMeta = glSuggestion
    ? {
        promoted_to_splits: promoted,
        threshold: HIGH_CONFIDENCE_GL_THRESHOLD,
      }
    : null

  return {
    ...draft,
    invoiceData: {
      ...draft.invoiceData,
      ...(promoted ? { gl_splits: nextSplits } : {}),
      parse_metadata: {
        ...(draft.invoiceData.parse_metadata || {}),
        ...(glSuggestion ? { gl_suggestion: glSuggestion, gl_suggestion_meta: promotionMeta } : {}),
      },
    },
    createInvoiceInput: {
      ...draft.createInvoiceInput,
      ...(promoted ? { glSplits: nextSplits } : {}),
      parseMetadata: {
        ...(draft.createInvoiceInput.parseMetadata || {}),
        ...(glSuggestion ? { gl_suggestion: glSuggestion, gl_suggestion_meta: promotionMeta } : {}),
      },
    },
  }
}

function markGlNeedsReview(draft) {
  const splits = Array.isArray(draft.invoiceData.gl_splits) ? draft.invoiceData.gl_splits : []
  const hasUsableSplit = splits.some(split => split && typeof split.gl_code === 'string' && split.gl_code.trim().length > 0)
  const needsReview = !hasUsableSplit

  return {
    ...draft,
    invoiceData: {
      ...draft.invoiceData,
      parse_metadata: {
        ...(draft.invoiceData.parse_metadata || {}),
        gl_needs_review: needsReview,
      },
    },
    createInvoiceInput: {
      ...draft.createInvoiceInput,
      parseMetadata: {
        ...(draft.createInvoiceInput.parseMetadata || {}),
        gl_needs_review: needsReview,
      },
    },
  }
}

function shouldUseFallbackParse(parsed) {
  if (!parsed) return true

  const rawTextLength = parsed.extraction?.rawTextLength ?? 0
  const confidence = clampConfidence(parsed.parseConfidence ?? 0) ?? 0

  if (rawTextLength < 80) return true
  if (!parsed.vendorName) return true
  if (parsed.amount == null) return true
  if (!parsed.invoiceNumber && !parsed.invoiceDate) return true
  if (confidence < 0.55) return true

  return false
}

function buildParseMetadata(parsed, channel) {
  return {
    channel,
    parseMethod: parsed?.parseMethod || null,
    parseConfidence: clampConfidence(parsed?.parseConfidence ?? null),
    parseNotes: parsed?.parseNotes || null,
    rawTextLength: parsed?.extraction?.rawTextLength ?? 0,
    rawTextPreview: parsed?.extraction?.rawTextPreview || '',
    lineCount: parsed?.extraction?.lineCount ?? 0,
    pageCount: parsed?.extraction?.pageCount ?? null,
    hasUsableText: parsed?.extraction?.hasUsableText === true,
    textLikelyMissing: parsed?.extraction?.textLikelyMissing === true,
    fallbackUsed: parsed?.parseMetadata?.fallbackUsed === true,
    fallbackMethod: parsed?.parseMetadata?.fallbackMethod || null,
    fallbackModel: parsed?.parseMetadata?.fallbackModel || null,
    fallbackReason: parsed?.parseMetadata?.fallbackReason || null,
    fallbackNotes: parsed?.parseMetadata?.fallbackNotes || null,
    fallbackWarning: parsed?.parseMetadata?.fallbackWarning || null,
  }
}

export async function parseAndNormalizeInvoice(file, { channel }) {
  try {
    const parsed = await parsePdfInvoice(file)
    const extraction = parsed?.extraction || {}
    console.debug(`[invoiceIngestion:${channel}] uploaded file:`, file?.name)
    console.debug(`[invoiceIngestion:${channel}] file details:`, {
      type: file?.type || null,
      size: file?.size ?? null,
      parseMethod: parsed?.parseMethod || 'text',
      rawTextLength: extraction.rawTextLength ?? 0,
      pageCount: extraction.pageCount ?? null,
    })
    console.debug(`[invoiceIngestion:${channel}] extracted raw text preview:`, extraction.rawTextPreview || '')
    console.debug(`[invoiceIngestion:${channel}] parsed object:`, parsed)
    return {
      parsed,
      parseError: null,
      parseStatus: resolveParseStatus(parsed, null),
    }
  } catch (error) {
    console.error(`[invoiceIngestion:${channel}] parse error:`, error)
    console.debug(`[invoiceIngestion:${channel}] uploaded file:`, file?.name)
    console.debug(`[invoiceIngestion:${channel}] extracted raw text:`, '')
    console.debug(`[invoiceIngestion:${channel}] parsed object:`, null)
    return {
      parsed: null,
      parseError: error,
      parseStatus: resolveParseStatus(null, error),
    }
  }
}

export function buildInvoiceDraft({ channel, source, submittedFields = {}, parsed, parseError }) {
  const normalizedFields = {
    vendorName: coerceString(submittedFields.vendorName),
    propertyName: canonicalizePropertyName(coerceString(submittedFields.propertyName)),
    invoiceNumber: coerceString(submittedFields.invoiceNumber),
    amount: coerceOptionalNumber(submittedFields.amount),
    contactEmail: coerceString(submittedFields.contactEmail),
    documentType: coerceString(submittedFields.documentType),
    notes: coerceString(submittedFields.notes),
  }

  const parseStatus = resolveParseStatus(parsed, parseError)
  const preferSubmitted = channel === 'internal'

  const chooseString = (submittedValue, parsedValue, { preferParsed = false } = {}) => {
    const safeSubmitted = submittedValue || ''
    const safeParsed = parsedValue || ''

    if (preferSubmitted && !preferParsed) return safeSubmitted || safeParsed || null
    return safeParsed || safeSubmitted || null
  }

  const chooseNumber = (submittedValue, parsedValue, { preferParsed = false } = {}) => {
    const safeSubmitted = submittedValue ?? null
    const safeParsed = parsedValue ?? null

    if (preferSubmitted && !preferParsed) return safeSubmitted ?? safeParsed ?? null
    return safeParsed ?? safeSubmitted ?? null
  }

  const extraction = resolveExtractedGl(parsed?.extractedGlCode)
  const extractionConfidence = clampConfidence(parsed?.extractedGlConfidence ?? null)
  const glExtractionMeta = extraction
    ? {
        raw: extraction.raw,
        normalized: extraction.normalized,
        resolved: extraction.resolved,
        description: extraction.account?.name || null,
        source: parsed?.extractedGlSource || null,
        confidence: extractionConfidence,
      }
    : null

  const invoiceData = {
    vendor_name: chooseString(normalizedFields.vendorName, parsed?.vendorName),
    property_name: chooseString(
      normalizedFields.propertyName,
      canonicalizePropertyName(parsed?.propertyName || parsed?.serviceLocation) || parsed?.propertyName || parsed?.serviceLocation,
      { preferParsed: channel === 'vendor' }
    ),
    invoice_number: chooseString(normalizedFields.invoiceNumber, parsed?.invoiceNumber, { preferParsed: channel === 'vendor' }),
    amount: chooseNumber(normalizedFields.amount, parsed?.amount, { preferParsed: channel === 'vendor' }),
    invoice_date: parsed?.invoiceDate || null,
    due_date: parsed?.dueDate || null,
    bill_to_name: parsed?.billTo || null,
    line_items: Array.isArray(parsed?.lineItems) ? parsed.lineItems : [],
    description: parsed?.description || parsed?.parseNotes || normalizedFields.notes || null,
    raw_text: parsed?.rawText || null,
    parse_status: parseStatus,
    parse_errors: parseError?.message || null,
    parse_method: parsed?.parseMethod || null,
    parse_confidence: clampConfidence(parsed?.parseConfidence ?? null),
    parse_metadata: {
      ...buildParseMetadata(parsed, channel),
      ...(glExtractionMeta ? { gl_extraction: glExtractionMeta } : {}),
    },
    source,
    vendor_email: normalizedFields.contactEmail || null,
    document_type: normalizedFields.documentType || null,
    notes: normalizedFields.notes || null,
  }

  // Seed a default gl_splits row when the parser extracted a code (resolved or
  // not). Persisting it now means the allocation editor reads the parsed code
  // on the very first render — no manual entry required if the chart matches.
  // Unresolved codes still flow through so the UI can show a "needs chart
  // match" suggestion rather than silently dropping the extraction.
  let seededGlSplits = null
  if (extraction && invoiceData.amount != null) {
    const portfolio = resolvePortfolio(invoiceData.property_name)
    seededGlSplits = [{
      entity_code: portfolio.entity_code || '',
      entity_name: portfolio.entity_name || '',
      gl_code: extraction.normalized,
      amount: Number(invoiceData.amount),
      description: invoiceData.description || extraction.account?.name || 'Default allocation',
    }]
  }

  if (seededGlSplits) {
    invoiceData.gl_splits = seededGlSplits
  }

  const createInvoiceInput = {
    vendorName: invoiceData.vendor_name,
    propertyName: invoiceData.property_name,
    invoiceNumber: invoiceData.invoice_number,
    amount: invoiceData.amount,
    invoiceDate: invoiceData.invoice_date,
    dueDate: invoiceData.due_date,
    billToName: invoiceData.bill_to_name,
    description: invoiceData.description,
    lineItems: invoiceData.line_items,
    rawText: invoiceData.raw_text,
    parseStatus: invoiceData.parse_status,
    parseErrors: invoiceData.parse_errors,
    parseMethod: invoiceData.parse_method,
    parseConfidence: invoiceData.parse_confidence,
    parseMetadata: invoiceData.parse_metadata,
    source: invoiceData.source,
    vendorEmail: invoiceData.vendor_email,
    documentType: invoiceData.document_type,
    notes: invoiceData.notes,
    glSplits: seededGlSplits,
  }

  console.debug(`[invoiceIngestion:${channel}] vendor-submitted form object:`, normalizedFields)
  console.debug(`[invoiceIngestion:${channel}] merged final invoice object:`, invoiceData)

  return { normalizedFields, invoiceData, createInvoiceInput, parseStatus }
}

export async function finalizeInvoiceDraftAfterUpload({
  channel,
  source,
  submittedFields = {},
  parsed,
  parseError,
  file,
  fileUrl,
}) {
  let nextParsed = parsed
  let nextParseError = parseError
  const fallbackAttempted = shouldUseFallbackParse(parsed)

  if (fileUrl && file?.type === 'application/pdf' && fallbackAttempted) {
    try {
      const fallbackResponse = await invokeInvoiceParseFallback({
        fileUrl,
        fileName: file?.name,
        fileType: file?.type,
        channel,
        initialParse: {
          parseMethod: parsed?.parseMethod || 'text',
          parseConfidence: clampConfidence(parsed?.parseConfidence ?? null),
          rawTextLength: parsed?.extraction?.rawTextLength ?? 0,
          rawTextPreview: parsed?.extraction?.rawTextPreview || '',
          vendorName: parsed?.vendorName || null,
          invoiceNumber: parsed?.invoiceNumber || null,
          amount: parsed?.amount ?? null,
          propertyName: parsed?.propertyName || null,
        },
      })

      const fallbackParsed = normalizeFallbackParsed(fallbackResponse)
      nextParsed = mergeParsedResults(parsed, fallbackParsed)
      console.debug(`[invoiceIngestion:${channel}] fallback parse response:`, fallbackResponse)
      console.debug(`[invoiceIngestion:${channel}] merged parse object:`, nextParsed)
      nextParseError = null
    } catch (fallbackError) {
      console.warn(`[invoiceIngestion:${channel}] fallback parse failed:`, fallbackError)
      nextParseError = fallbackError
      if (nextParsed) {
        nextParsed = {
          ...nextParsed,
          parseMetadata: {
            ...(nextParsed.parseMetadata || {}),
            fallbackUsed: true,
            fallbackFailed: true,
            fallbackReason: fallbackError.message,
          },
          extraction: {
            ...(nextParsed.extraction || {}),
            fallbackUsed: true,
          },
        }
      }
    }
  }

  let draft = buildInvoiceDraft({
    channel,
    source,
    submittedFields,
    parsed: nextParsed,
    parseError: nextParseError,
  })

  const glExtraction = draft.invoiceData.parse_metadata?.gl_extraction || null
  if (shouldClassifyGlCode(nextParsed, draft.invoiceData, glExtraction)) {
    try {
      const suggestion = await classifyGLCode(draft.invoiceData, { channel })
      if (suggestion) {
        console.debug(`[invoiceIngestion:${channel}] gl classifier:`, suggestion)
        draft = attachGlSuggestion(draft, suggestion)
      }
    } catch (classifyError) {
      console.warn(`[invoiceIngestion:${channel}] gl classifier failed:`, classifyError)
    }
  }

  draft = markGlNeedsReview(draft)

  console.debug(`[invoiceIngestion:${channel}] finalized draft:`, {
    fileUrl,
    fileType: file?.type || null,
    storagePath: typeof fileUrl === 'string'
      ? decodeURIComponent((fileUrl.match(/\/storage\/v1\/object\/public\/invoices\/(.+)$/) || [])[1] || '')
      : null,
    rawTextLength: nextParsed?.extraction?.rawTextLength ?? 0,
    rawTextPreview: nextParsed?.extraction?.rawTextPreview || '',
    parseMethod: nextParsed?.parseMethod || null,
    parseConfidence: nextParsed?.parseConfidence ?? null,
    parsedObject: nextParsed,
    invoiceData: draft.invoiceData,
  })

  return {
    ...draft,
    parsed: nextParsed,
    parseError: nextParseError,
  }
}
