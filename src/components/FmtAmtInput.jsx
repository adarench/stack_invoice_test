import { useState } from 'react'
import { fmtFull, parseAmount } from '../lib/format'

export default function FmtAmtInput({
  value,
  onChange,
  placeholder,
  style,
  disabled,
  className,
  step,
}) {
  const [focused, setFocused] = useState(false)
  const [rawText, setRawText] = useState(value != null ? String(value) : '')

  const displayValue = focused
    ? rawText
    : (value != null && value !== '' ? fmtFull(value) : '')

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      style={style}
      value={displayValue}
      onFocus={() => {
        setRawText(value != null ? String(value) : '')
        setFocused(true)
      }}
      onChange={(e) => {
        const next = e.target.value.replace(/[^0-9.\-]/g, '')
        setRawText(next)
        onChange?.(parseAmount(next))
      }}
      onBlur={() => {
        setFocused(false)
        const parsed = parseAmount(rawText)
        setRawText(parsed != null ? String(parsed) : '')
        onChange?.(parsed)
      }}
    />
  )
}
