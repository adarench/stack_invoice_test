import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUBJECT_MAP: Record<string, (inv: any) => string> = {
  submit_for_review: (inv) => `Invoice ${inv.invoice_number || inv.id?.slice(0, 8) || ''} assigned for your review`,
  approve: (inv) => `Invoice ${inv.invoice_number || inv.id?.slice(0, 8) || ''} approved`,
  reject: (inv) => `Invoice ${inv.invoice_number || inv.id?.slice(0, 8) || ''} needs attention`,
  send_back: (inv) => `Invoice ${inv.invoice_number || inv.id?.slice(0, 8) || ''} needs attention`,
  mark_paid: (inv) => `Invoice ${inv.invoice_number || inv.id?.slice(0, 8) || ''} — payment processed`,
  assign: (inv) => `Invoice ${inv.invoice_number || inv.id?.slice(0, 8) || ''} assigned to you`,
  vendor_submission: (inv) => `New vendor invoice: ${inv.vendor_name} — ${inv.property_name || 'no property'}`,
}

const ACTION_DESCRIPTION: Record<string, string> = {
  submit_for_review: 'has been submitted for your review',
  approve: 'has been approved',
  reject: 'has been returned and needs attention',
  send_back: 'has been sent back for clarification',
  mark_paid: 'has been marked as paid',
  assign: 'has been assigned to you',
  vendor_submission: 'A new invoice has been submitted by a vendor',
}

function buildHtml(action: string, invoice: any, actor: any): string {
  const invNum = invoice.invoice_number || invoice.id?.slice(0, 8) || 'N/A'
  const amount = invoice.amount != null
    ? `$${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    : 'N/A'
  const desc = ACTION_DESCRIPTION[action] || 'has been updated'

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 24px;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
    <div style="padding: 20px 24px; border-bottom: 1px solid #e2e8f0; background: #f1f5f9;">
      <div style="font-size: 13px; font-weight: 700; color: #1e40af; letter-spacing: -0.02em;">OpsFlow</div>
    </div>
    <div style="padding: 24px;">
      <p style="margin: 0 0 16px; font-size: 14px; color: #334155; line-height: 1.5;">
        Invoice <strong style="color: #1e293b;">#${invNum}</strong> ${desc}.
      </p>
      <table style="width: 100%; font-size: 13px; color: #475569; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #94a3b8;">Vendor</td><td style="padding: 6px 0; text-align: right; font-weight: 500;">${invoice.vendor_name || '—'}</td></tr>
        <tr><td style="padding: 6px 0; color: #94a3b8;">Property</td><td style="padding: 6px 0; text-align: right; font-weight: 500;">${invoice.property_name || '—'}</td></tr>
        <tr><td style="padding: 6px 0; color: #94a3b8;">Amount</td><td style="padding: 6px 0; text-align: right; font-weight: 600; color: #0f172a;">${amount}</td></tr>
        ${actor?.name ? `<tr><td style="padding: 6px 0; color: #94a3b8;">By</td><td style="padding: 6px 0; text-align: right; font-weight: 500;">${actor.name}</td></tr>` : ''}
      </table>
    </div>
    <div style="padding: 16px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc;">
      <p style="margin: 0; font-size: 11px; color: #94a3b8;">This is an automated notification from OpsFlow.</p>
    </div>
  </div>
</body>
</html>`
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    if (!RESEND_API_KEY) {
      console.error('[send-notification] RESEND_API_KEY not configured')
      return new Response(
        JSON.stringify({ success: false, error: 'RESEND_API_KEY not configured' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const { action, invoice, recipients, actor } = await req.json()

    if (!action || !recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, failed: 0, reason: 'no recipients' }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const subjectFn = SUBJECT_MAP[action] || (() => `OpsFlow: Invoice update`)
    const subject = subjectFn(invoice || {})
    const html = buildHtml(action, invoice || {}, actor)

    const results = await Promise.allSettled(
      recipients.map(async (r: { email: string; name: string }) => {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'OpsFlow <onboarding@resend.dev>',
            to: [r.email],
            subject,
            html,
          }),
        })
        if (!res.ok) {
          const err = await res.text()
          console.error(`[send-notification] Failed to send to ${r.email}:`, err)
          throw new Error(err)
        }
        return r.email
      })
    )

    const sent = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    console.log(`[send-notification] action=${action} sent=${sent} failed=${failed}`)

    return new Response(
      JSON.stringify({ success: true, sent, failed }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[send-notification] Error:', err)
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
