import { useEffect, useMemo, useState } from 'react'
import {
  PROPERTY_OPTIONS,
  UNMAPPED_PROPERTY_VALUE,
  canonicalizePropertyName,
  findPropertyCatalogEntry,
  getPropertyDisplayLabel,
  suggestPropertyCatalogEntry,
} from '../data/propertyCatalog'

export default function PropertySelect({
  value,
  onChange,
  parsedValue = '',
  selectStyle,
  inputStyle,
  emptyLabel = 'Select a property',
  unmappedLabel = 'Other / Unmapped',
  unmappedPlaceholder = 'Enter property name if it is not in the catalog',
}) {
  const matchedEntry = useMemo(() => findPropertyCatalogEntry(value), [value])
  const parsedMatch = useMemo(() => findPropertyCatalogEntry(parsedValue), [parsedValue])
  const suggestion = useMemo(() => {
    if (matchedEntry) return null
    return suggestPropertyCatalogEntry(value || parsedValue)
  }, [matchedEntry, parsedValue, value])
  const [showUnmappedInput, setShowUnmappedInput] = useState(Boolean(value && !matchedEntry))

  useEffect(() => {
    setShowUnmappedInput(Boolean(value && !matchedEntry))
  }, [matchedEntry, value])

  const selectValue = matchedEntry
    ? matchedEntry.property_name
    : showUnmappedInput
      ? UNMAPPED_PROPERTY_VALUE
      : ''

  const applyCatalogValue = (nextValue) => {
    const canonical = canonicalizePropertyName(nextValue)
    onChange?.(canonical || nextValue)
  }

  return (
    <div className="space-y-2">
      <select
        value={selectValue}
        onChange={(e) => {
          const nextValue = e.target.value
          if (!nextValue) {
            setShowUnmappedInput(false)
            onChange?.('')
            return
          }

          if (nextValue === UNMAPPED_PROPERTY_VALUE) {
            setShowUnmappedInput(true)
            if (matchedEntry) onChange?.('')
            return
          }

          setShowUnmappedInput(false)
          applyCatalogValue(nextValue)
        }}
        style={selectStyle}
      >
        <option value="">{emptyLabel}</option>
        {PROPERTY_OPTIONS.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        <option value={UNMAPPED_PROPERTY_VALUE}>{unmappedLabel}</option>
      </select>

      {showUnmappedInput && (
        <input
          value={matchedEntry?.property_name ? '' : (value || '')}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={unmappedPlaceholder}
          style={inputStyle}
        />
      )}

      {!matchedEntry && suggestion && (
        <div
          className="rounded-md px-3 py-2 text-xs flex items-center justify-between gap-3"
          style={{
            backgroundColor: 'rgba(59,130,246,0.06)',
            border: '1px solid rgba(59,130,246,0.15)',
            color: 'var(--text-4)',
          }}
        >
          <span>
            Suggested property: <strong>{getPropertyDisplayLabel(suggestion)}</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              setShowUnmappedInput(false)
              applyCatalogValue(suggestion.property_name)
            }}
            className="text-xs font-semibold px-2 py-1 rounded"
            style={{ backgroundColor: 'rgba(59,130,246,0.12)', color: '#2563EB' }}
          >
            Use Suggestion
          </button>
        </div>
      )}

      {!matchedEntry && parsedValue && parsedMatch && !value && (
        <div className="text-xs" style={{ color: 'var(--text-6)' }}>
          Parsed property matched to <strong>{getPropertyDisplayLabel(parsedMatch)}</strong>.
        </div>
      )}
    </div>
  )
}
