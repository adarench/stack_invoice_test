import { supabase } from '../lib/supabaseClient'

export async function invokeInvoiceParseFallback({
  fileUrl,
  fileName,
  fileType,
  channel,
  initialParse,
}) {
  if (!supabase || !fileUrl) return null

  const { data, error } = await supabase.functions.invoke('parse-invoice-fallback', {
    body: {
      fileUrl,
      fileName: fileName || null,
      fileType: fileType || 'application/pdf',
      channel: channel || 'internal',
      initialParse: initialParse || null,
    },
  })

  if (error) {
    throw error
  }

  return data
}
