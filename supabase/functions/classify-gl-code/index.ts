import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import glExpenseAccounts from './glExpenseAccounts.json' with { type: 'json' }

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-20250514'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type GlAccount = {
  gl_code: string
  gl_description: string
  category: string
  type: string
  recoverable: boolean
}

const ACCOUNTS = glExpenseAccounts as GlAccount[]
const VALID_CODES = new Set(ACCOUNTS.map(a => a.gl_code))
const ACCOUNT_INDEX = new Map(ACCOUNTS.map(a => [a.gl_code, a]))

function chartBlock(): string {
  return ACCOUNTS
    .map(a => `${a.gl_code} | ${a.gl_description} | ${a.category} | ${a.recoverable ? 'R' : 'NR'}`)
    .join('\n')
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function clampConfidence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return value <= 100 ? Number((value / 100).toFixed(3)) : 1
  return Number(value.toFixed(3))
}

function extractJson(text: string): Record<string, unknown> {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```([\s\S]*?)```/i)
  const candidate = (fenced?.[1] || text).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error('No JSON object in classifier response')
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

function buildInvoiceSummary(invoice: any): string {
  const lines: string[] = []
  if (invoice?.vendor_name) lines.push(`Vendor: ${invoice.vendor_name}`)
  if (invoice?.invoice_number) lines.push(`Invoice #: ${invoice.invoice_number}`)
  if (invoice?.amount != null) lines.push(`Amount: ${invoice.amount}`)
  if (invoice?.property_name) lines.push(`Property: ${invoice.property_name}`)
  if (invoice?.service_location) lines.push(`Service location: ${invoice.service_location}`)
  if (invoice?.description) lines.push(`Description: ${invoice.description}`)

  if (Array.isArray(invoice?.line_items) && invoice.line_items.length > 0) {
    lines.push('Line items:')
    for (const item of invoice.line_items.slice(0, 20)) {
      const desc = item?.description || ''
      const total = item?.total
      const qty = item?.qty
      const unit = item?.unit_price
      const parts = [desc]
      if (qty != null) parts.push(`qty ${qty}`)
      if (unit != null) parts.push(`@ ${unit}`)
      if (total != null) parts.push(`= ${total}`)
      lines.push(`- ${parts.filter(Boolean).join(' ')}`)
    }
  }

  if (invoice?.raw_text) {
    const truncated = String(invoice.raw_text).slice(0, 4000)
    lines.push('Raw OCR text (truncated):')
    lines.push(truncated)
  }

  return lines.join('\n')
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

    const { invoice, channel } = await req.json()
    if (!invoice || typeof invoice !== 'object') {
      return new Response(
        JSON.stringify({ error: 'invoice is required' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const summary = buildInvoiceSummary(invoice)
    const prompt = [
      'You are an accounting assistant classifying an invoice into a G/L code.',
      'You will be given a chart of accounts (expense codes only) and a parsed invoice.',
      'Choose the single best G/L code from the provided chart.',
      '',
      'Rules:',
      '- You MUST return a code that appears verbatim in the chart below.',
      '- Do NOT invent codes. Do NOT pick more than one.',
      '- 5xxx codes are recoverable expenses; 6xxx are non-recoverable. Prefer 5xxx unless context indicates non-recoverable.',
      '- Match on vendor type, description, line items, and patterns (cleaning, landscaping, utilities, maintenance, etc.).',
      '- Output STRICT JSON only, no prose, no markdown fence.',
      '',
      'Chart of accounts (gl_code | gl_description | category | R=Recoverable / NR=Non-Recoverable):',
      chartBlock(),
      '',
      `Channel: ${typeof channel === 'string' ? channel : 'internal'}`,
      'Parsed invoice:',
      summary || '(no fields available)',
      '',
      'Return JSON with exactly these keys:',
      '{',
      '  "suggested_gl_code": string,',
      '  "suggested_gl_description": string,',
      '  "confidence": number,',
      '  "reasoning": string',
      '}',
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
        max_tokens: 400,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!anthropicResponse.ok) {
      const errorBody = await anthropicResponse.text()
      throw new Error(`Anthropic API error ${anthropicResponse.status}: ${errorBody}`)
    }

    const payload = await anthropicResponse.json()
    const responseText = extractResponseText(payload)
    const parsed = extractJson(responseText)

    const code = normalizeString(parsed.suggested_gl_code)
    const isValid = code != null && VALID_CODES.has(code)
    const account = code ? ACCOUNT_INDEX.get(code) : null
    const description = isValid && account
      ? account.gl_description
      : (normalizeString(parsed.suggested_gl_description) || null)

    const result = {
      suggested_gl_code: isValid ? code : null,
      suggested_gl_description: description,
      confidence: clampConfidence(parsed.confidence),
      reasoning: normalizeString(parsed.reasoning) || '',
      model: ANTHROPIC_MODEL,
      catalog_size: ACCOUNTS.length,
      hallucinated_code: !isValid,
      raw_response_preview: responseText.slice(0, 400),
    }

    console.log('[classify-gl-code] result', {
      vendor: invoice?.vendor_name,
      suggested: result.suggested_gl_code,
      confidence: result.confidence,
      hallucinated: result.hallucinated_code,
    })

    return new Response(
      JSON.stringify(result),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[classify-gl-code] error', error)
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
