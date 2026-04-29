import { supabase } from '../lib/supabaseClient'

// classifyGLCode(invoice, { channel })
//
// Calls the `classify-gl-code` Edge Function which uses Anthropic to suggest
// the best G/L code for a parsed invoice from the chart of accounts.
//
// Returns:
//   {
//     suggested_gl_code: string | null,
//     suggested_gl_description: string | null,
//     confidence: number,        // 0..1
//     reasoning: string,
//     model: string,
//     catalog_size: number,
//     hallucinated_code: boolean // true if model returned a code not in the chart
//   }
//
// Returns null when Supabase isn't configured (mock mode) so callers can
// degrade gracefully and rely on keyword suggestions instead.
export async function classifyGLCode(invoice, { channel = 'internal' } = {}) {
  if (!supabase || !invoice) return null

  const payload = {
    vendor_name: invoice.vendor_name || invoice.vendorName || null,
    invoice_number: invoice.invoice_number || invoice.invoiceNumber || null,
    amount: invoice.amount ?? null,
    property_name: invoice.property_name || invoice.propertyName || null,
    service_location: invoice.service_location || invoice.serviceLocation || null,
    description: invoice.description || null,
    line_items: Array.isArray(invoice.line_items)
      ? invoice.line_items
      : Array.isArray(invoice.lineItems)
        ? invoice.lineItems
        : [],
    raw_text: invoice.raw_text || invoice.rawText || null,
  }

  const { data, error } = await supabase.functions.invoke('classify-gl-code', {
    body: { invoice: payload, channel },
  })

  if (error) {
    throw error
  }

  return data
}
