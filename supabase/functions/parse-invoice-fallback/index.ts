import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-20250514'

// Lift handwritten/stamped GL codes the model leaves in commentary fields.
// Pattern: "ACCT CODE 5416", "Account #5416-00", "GL: 5416", etc. The frontend
// resolves the recovered code against the full chart of accounts before use,
// so we only constrain to the expense range (5xxx / 6xxx) here.
const GL_CODE_REGEX = /(?:ACCT|ACCOUNT|GL|G\/L)\s*(?:CODE|ACCOUNT|#)?\s*[:#]?\s*([56]\d{3})(?:-(\d{2}))?/gi

function normalizeGlCodeStr(raw: string): string | null {
  const match = raw.match(/([56]\d{3})(?:-(\d{2}))?/)
  if (!match) return null
  const tail = match[2] || '00'
  return `${match[1]}-${tail}`
}

function recoverGlCodeFromText(...sources: Array<string | null | undefined>): string | null {
  for (const src of sources) {
    if (!src) continue
    GL_CODE_REGEX.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = GL_CODE_REGEX.exec(src)) !== null) {
      const tail = m[2] ? `-${m[2]}` : '-00'
      return `${m[1]}${tail}`
    }
  }
  return null
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function toBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  let binary = ''

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Number(value)
  if (typeof value === 'string') {
    const numeric = Number.parseFloat(value.replace(/[$,\s]/g, ''))
    if (Number.isFinite(numeric)) return numeric
  }
  return null
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0.5
  if (value < 0) return 0
  if (value > 1) {
    if (value <= 100) return Number((value / 100).toFixed(3))
    return 1
  }
  return Number(value.toFixed(3))
}

function normalizeLineItems(items: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(items)) return []

  return items
    .map((item) => ({
      description: normalizeString(item?.description) || '',
      qty: normalizeAmount(item?.qty),
      unit_price: normalizeAmount(item?.unit_price),
      total: normalizeAmount(item?.total),
    }))
    .filter((item) => item.description || item.qty != null || item.unit_price != null || item.total != null)
}

function extractJson(text: string): Record<string, unknown> {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```([\s\S]*?)```/i)
  const candidate = (fenced?.[1] || text).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')

  if (start < 0 || end <= start) {
    throw new Error('No JSON object found in Anthropic response')
  }

  return JSON.parse(candidate.slice(start, end + 1))
}

function extractResponseText(payload: any): string {
  if (!payload?.content || !Array.isArray(payload.content)) return ''
  return payload.content
    .filter((block: any) => block?.type === 'text')
    .map((block: any) => block.text || '')
    .join('\n')
    .trim()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const { fileUrl, fileName, fileType, channel, initialParse } = await req.json()

    if (!fileUrl || typeof fileUrl !== 'string') {
      return new Response(
        JSON.stringify({ error: 'fileUrl is required' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const pdfResponse = await fetch(fileUrl)
    if (!pdfResponse.ok) {
      throw new Error(`Failed to download PDF: ${pdfResponse.status}`)
    }

    const mediaType = typeof fileType === 'string' && fileType.trim() ? fileType : 'application/pdf'
    const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer())
    const pdfBase64 = toBase64(pdfBytes)

    const prompt = [
      'Extract structured invoice data from this PDF for an accounts payable workflow.',
      'The PDF may be a scanned image with no text layer.',
      'Return only a single JSON object with exactly these keys:',
      '{',
      '  "vendor_name": string | null,',
      '  "invoice_number": string | null,',
      '  "amount": number | null,',
      '  "invoice_date": string | null,',
      '  "due_date": string | null,',
      '  "property_name": string | null,',
      '  "service_location": string | null,',
      '  "bill_to_name": string | null,',
      '  "description": string | null,',
      '  "line_items": Array<{ "description": string, "qty": number | null, "unit_price": number | null, "total": number | null }>,',
      '  "extracted_gl_code": string | null,',
      '  "extracted_gl_source": string | null,',
      '  "extracted_gl_confidence": number | null,',
      '  "confidence": number,',
      '  "notes": string | null',
      '}',
      'Rules:',
      '- Use null when a scalar field is not legible.',
      '- Use [] for line_items when not legible.',
      '- amount must be the final invoice total / balance due, not a line item.',
      '- invoice_date and due_date must be YYYY-MM-DD when inferable; otherwise null.',
      '- property_name should be the named property, building, project, or service site when identifiable.',
      '- service_location can hold the job site/address if it differs from bill-to.',
      '- Do not invent values. Prefer null over guessing.',
      '- confidence must be a number between 0 and 1.',
      '',
      'extracted_gl_code rules:',
      '- Look for any G/L account code on the invoice: handwritten notes, accounting stamps, memo lines,',
      '  printed coding fields, line-item account columns. Common labels include:',
      '  "ACCT CODE", "Account Code", "Account #", "GL Code", "G/L", "G/L #", "GL #", "GL Account".',
      '- Capture the raw code exactly as written (digits and any suffix). Examples: "5416", "5416-00", "5416.00".',
      '- Do NOT include the label, currency, or surrounding text — just the code.',
      '- extracted_gl_source describes where you saw it: "handwritten_note", "stamp", "memo_field",',
      '  "line_item", "header", "footer", or null.',
      '- extracted_gl_confidence is your confidence (0..1) that this is a G/L account code, not just a number.',
      '- Use null for all three if no code is visible. Do NOT invent a code.',
      '- CRITICAL: If you read text like "ACCT CODE 5416", "Account # 5416-00", or "GL 5416" anywhere on the page,',
      '  you MUST return extracted_gl_code: "5416-00" (or whatever the digits were) — NOT null. Do not bury',
      '  the code in the notes field instead of populating extracted_gl_code. Example:',
      '    Handwritten: "ACCT CODE 5416"  →  extracted_gl_code: "5416-00", extracted_gl_source: "handwritten_note"',
      '    Stamp:       "GL #6210"       →  extracted_gl_code: "6210-00", extracted_gl_source: "stamp"',
      '',
      `Channel: ${typeof channel === 'string' ? channel : 'internal'}`,
      `File name: ${typeof fileName === 'string' ? fileName : 'unknown.pdf'}`,
      `Client parse summary: ${JSON.stringify(initialParse || null)}`,
    ].join('\n')

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1400,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: pdfBase64,
                },
              },
            ],
          },
        ],
      }),
    })

    if (!anthropicResponse.ok) {
      const errorBody = await anthropicResponse.text()
      throw new Error(`Anthropic API error ${anthropicResponse.status}: ${errorBody}`)
    }

    const anthropicPayload = await anthropicResponse.json()
    const responseText = extractResponseText(anthropicPayload)
    const parsed = extractJson(responseText)

    let extractedGlCode = normalizeString(parsed.extracted_gl_code)
    let extractedGlSource = normalizeString(parsed.extracted_gl_source)
    let extractedGlConfidence = typeof parsed.extracted_gl_confidence === 'number'
      ? normalizeConfidence(parsed.extracted_gl_confidence)
      : null
    let extractedGlRecovered = false

    // Normalize a model-returned bare code ("5416") to canonical "5416-00".
    if (extractedGlCode) {
      const canonical = normalizeGlCodeStr(extractedGlCode)
      if (canonical) extractedGlCode = canonical
    }

    // Recovery sweep: if the model left the code in notes/description instead
    // of extracted_gl_code, lift it. Example case: invoice 3598 had handwritten
    // "ACCT CODE 5416" surfaced in notes but extracted_gl_code came back null.
    if (!extractedGlCode) {
      const recovered = recoverGlCodeFromText(
        normalizeString(parsed.notes),
        normalizeString(parsed.description),
        responseText,
      )
      if (recovered) {
        extractedGlCode = recovered
        extractedGlSource = extractedGlSource || 'recovered_from_notes'
        extractedGlConfidence = extractedGlConfidence ?? 0.7
        extractedGlRecovered = true
      }
    }

    const normalized = {
      vendor_name: normalizeString(parsed.vendor_name),
      invoice_number: normalizeString(parsed.invoice_number),
      amount: normalizeAmount(parsed.amount),
      invoice_date: normalizeString(parsed.invoice_date),
      due_date: normalizeString(parsed.due_date),
      property_name: normalizeString(parsed.property_name),
      service_location: normalizeString(parsed.service_location),
      bill_to_name: normalizeString(parsed.bill_to_name),
      description: normalizeString(parsed.description),
      line_items: normalizeLineItems(parsed.line_items),
      extracted_gl_code: extractedGlCode,
      extracted_gl_source: extractedGlSource,
      extracted_gl_confidence: extractedGlConfidence,
      extracted_gl_recovered: extractedGlRecovered,
      confidence: normalizeConfidence(parsed.confidence),
      notes: normalizeString(parsed.notes),
      parse_method: 'llm_pdf',
      model: ANTHROPIC_MODEL,
      reason: 'insufficient_text_layer',
      raw_response_preview: responseText.slice(0, 500),
    }

    console.log('[parse-invoice-fallback] parsed', {
      fileUrl,
      fileName,
      confidence: normalized.confidence,
      vendor_name: normalized.vendor_name,
      invoice_number: normalized.invoice_number,
      amount: normalized.amount,
      property_name: normalized.property_name,
    })

    return new Response(
      JSON.stringify(normalized),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[parse-invoice-fallback] error', error)
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
