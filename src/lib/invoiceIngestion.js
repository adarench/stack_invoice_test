import { parsePdfInvoice } from './parsePdf.js'

function coerceString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function coerceOptionalNumber(value) {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
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
  if (parseError) return 'failed'
  const parsedCount = countParsedFields(parsed)
  if (parsedCount >= 3) return 'parsed'
  if (parsedCount > 0) return 'partial'
  return 'manual'
}

export async function parseAndNormalizeInvoice(file, { channel }) {
  try {
    const parsed = await parsePdfInvoice(file)
    console.debug(`[invoiceIngestion:${channel}] uploaded file:`, file?.name)
    console.debug(`[invoiceIngestion:${channel}] extracted raw text:`, parsed.rawText || '')
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
    propertyName: coerceString(submittedFields.propertyName),
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

  const invoiceData = {
    vendor_name: chooseString(normalizedFields.vendorName, parsed?.vendorName),
    property_name: chooseString(normalizedFields.propertyName, parsed?.propertyName, { preferParsed: channel === 'vendor' }),
    invoice_number: chooseString(normalizedFields.invoiceNumber, parsed?.invoiceNumber, { preferParsed: channel === 'vendor' }),
    amount: chooseNumber(normalizedFields.amount, parsed?.amount, { preferParsed: channel === 'vendor' }),
    invoice_date: parsed?.invoiceDate || null,
    due_date: parsed?.dueDate || null,
    bill_to_name: parsed?.billTo || null,
    line_items: Array.isArray(parsed?.lineItems) ? parsed.lineItems : [],
    description: parsed?.description || normalizedFields.notes || null,
    raw_text: parsed?.rawText || null,
    parse_status: parseStatus,
    parse_errors: parseError?.message || null,
    source,
    vendor_email: normalizedFields.contactEmail || null,
    document_type: normalizedFields.documentType || null,
    notes: normalizedFields.notes || null,
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
    source: invoiceData.source,
    vendorEmail: invoiceData.vendor_email,
    documentType: invoiceData.document_type,
    notes: invoiceData.notes,
  }

  console.debug(`[invoiceIngestion:${channel}] vendor-submitted form object:`, normalizedFields)
  console.debug(`[invoiceIngestion:${channel}] merged final invoice object:`, invoiceData)

  return { normalizedFields, invoiceData, createInvoiceInput, parseStatus }
}
