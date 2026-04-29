function formatMethod(parseMethod) {
  switch (parseMethod) {
    case 'text':
      return 'Text extraction'
    case 'llm_pdf':
      return 'Vision fallback'
    case 'text+llm_pdf':
      return 'Text + vision fallback'
    default:
      return 'Manual review'
  }
}

function formatConfidence(confidence) {
  if (!Number.isFinite(Number(confidence))) return null
  return `${Math.round(Number(confidence) * 100)}% confidence`
}

function bannerStyles(parseStatus) {
  switch (parseStatus) {
    case 'failed':
      return {
        border: '1px solid rgba(239,68,68,0.35)',
        backgroundColor: 'rgba(239,68,68,0.12)',
        color: '#991B1B',
        title: 'Parsing failed',
      }
    case 'manual':
      return {
        border: '1px solid rgba(245,158,11,0.35)',
        backgroundColor: 'rgba(245,158,11,0.12)',
        color: '#92400E',
        title: 'Manual review needed',
      }
    case 'partial':
      return {
        border: '1px solid rgba(245,158,11,0.35)',
        backgroundColor: 'rgba(245,158,11,0.12)',
        color: '#92400E',
        title: 'Parsing is incomplete',
      }
    default:
      return {
        border: '1px solid rgba(59,130,246,0.22)',
        backgroundColor: 'rgba(59,130,246,0.08)',
        color: '#1D4ED8',
        title: 'Parsing complete',
      }
  }
}

export default function ParseStatusBanner({ invoice }) {
  const parseStatus = invoice?.parse_status || 'manual'
  const styles = bannerStyles(parseStatus)
  const method = formatMethod(invoice?.parse_method)
  const confidence = formatConfidence(invoice?.parse_confidence)
  const fallbackNote = invoice?.parse_metadata?.fallbackNotes || invoice?.parse_metadata?.fallbackWarning
  const rawTextMissing = invoice?.parse_metadata?.textLikelyMissing === true || !invoice?.raw_text
  const glNeedsReview = invoice?.parse_metadata?.gl_needs_review === true
  const glSuggestion = invoice?.parse_metadata?.gl_suggestion || null
  const glSuggestionMeta = invoice?.parse_metadata?.gl_suggestion_meta || null
  const vendorMissing = !invoice?.vendor_name

  if (
    parseStatus === 'parsed' &&
    !fallbackNote &&
    !rawTextMissing &&
    !glNeedsReview &&
    !glSuggestion &&
    !vendorMissing
  ) return null

  return (
    <div
      className="rounded-md px-3 py-2 text-xs"
      style={{
        border: styles.border,
        backgroundColor: styles.backgroundColor,
        color: styles.color,
      }}
    >
      <div className="font-semibold">{styles.title}</div>
      <div className="mt-0.5">
        Path used: {method}{confidence ? ` · ${confidence}` : ''}
      </div>
      {vendorMissing && (
        <div className="mt-0.5">
          Vendor unknown — needs review.
        </div>
      )}
      {rawTextMissing && (
        <div className="mt-0.5">
          No usable text layer was detected. This invoice should be reviewed before approval.
        </div>
      )}
      {fallbackNote && (
        <div className="mt-0.5">
          {fallbackNote}
        </div>
      )}
      {glSuggestion?.code && glSuggestionMeta?.promoted_to_splits && (
        <div className="mt-1 px-2 py-1 rounded" style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#065F46', border: '1px solid rgba(16,185,129,0.25)' }}>
          <strong>GL auto-assigned:</strong> {glSuggestion.code}
          {glSuggestion.description ? ` — ${glSuggestion.description}` : ''}
          {Number.isFinite(glSuggestion.confidence) ? ` · ${Math.round(glSuggestion.confidence * 100)}% confidence` : ''}
          {glSuggestion.reasoning ? <div className="mt-0.5" style={{ opacity: 0.85 }}>{glSuggestion.reasoning}</div> : null}
        </div>
      )}
      {glNeedsReview && !glSuggestionMeta?.promoted_to_splits && (
        <div className="mt-1 px-2 py-1 rounded" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#991B1B', border: '1px solid rgba(239,68,68,0.25)' }}>
          <strong>GL needs review:</strong> no G/L code was assigned automatically. Pick a code in the allocation panel.
          {glSuggestion?.code ? (
            <div className="mt-0.5">Suggested: {glSuggestion.code}{glSuggestion.description ? ` — ${glSuggestion.description}` : ''}{Number.isFinite(glSuggestion.confidence) ? ` · ${Math.round(glSuggestion.confidence * 100)}%` : ''}</div>
          ) : null}
        </div>
      )}
      {invoice?.parse_errors && (
        <div className="mt-0.5">
          Error: {invoice.parse_errors}
        </div>
      )}
    </div>
  )
}
