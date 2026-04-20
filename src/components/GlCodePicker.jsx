import { useState, useRef, useEffect } from 'react'
import { searchGlAccounts, findGlAccount, validateGlCode } from '../data/chartOfAccounts'
import { CheckCircle, AlertTriangle, Info } from 'lucide-react'

export default function GlCodePicker({ value, onChange, placeholder, style, disabled }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  const results = searchGlAccounts(query || '', { limit: 30 })
  const validation = validateGlCode(value)
  const currentAccount = findGlAccount(value)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (!dropdownRef.current?.contains(e.target) && !inputRef.current?.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => { setHighlighted(0) }, [query])

  const handleSelect = (account) => {
    onChange?.(account.code)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { setOpen(true); e.preventDefault() }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && results[highlighted]) {
      e.preventDefault()
      handleSelect(results[highlighted])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const displayValue = open
    ? query
    : currentAccount
      ? `${currentAccount.code} ${currentAccount.name}`
      : (value || '')

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          placeholder={placeholder || 'Search GL accounts...'}
          style={{ ...style, flex: 1 }}
          value={displayValue}
          onFocus={() => { setQuery(''); setOpen(true) }}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
            if (!e.target.value.includes(' ')) onChange?.(e.target.value)
          }}
          onBlur={() => {
            setTimeout(() => {
              if (!dropdownRef.current?.contains(document.activeElement)) {
                setOpen(false)
              }
            }, 150)
          }}
          onKeyDown={handleKeyDown}
        />
        {value && !open && (
          <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            {validation.valid ? (
              <CheckCircle size={12} style={{ color: '#10B981' }} />
            ) : validation.level === 'warning' ? (
              <AlertTriangle size={12} style={{ color: '#F59E0B' }} title={validation.message} />
            ) : validation.level === 'info' ? (
              <Info size={12} style={{ color: 'var(--text-6)' }} title={validation.message} />
            ) : null}
          </span>
        )}
      </div>

      {currentAccount && !open && (
        <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              padding: '1px 4px',
              borderRadius: 3,
              backgroundColor: currentAccount.recoverable ? 'rgba(16,185,129,0.12)' : 'rgba(156,163,175,0.15)',
              color: currentAccount.recoverable ? '#059669' : '#6B7280',
            }}
          >
            {currentAccount.recoverable ? 'R' : 'NR'}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-6)' }}>
            {currentAccount.recoverable ? 'Recoverable' : 'Non-Recoverable'}
          </span>
        </div>
      )}

      {!validation.valid && validation.message && !open && (
        <div style={{ fontSize: 10, marginTop: 2, color: validation.level === 'warning' ? '#F59E0B' : 'var(--text-6)' }}>
          {validation.message}
        </div>
      )}

      {open && results.length > 0 && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 50,
            maxHeight: 240,
            overflowY: 'auto',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            marginTop: 2,
          }}
        >
          {results.map((account, i) => (
            <div
              key={account.code}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(account) }}
              onMouseEnter={() => setHighlighted(i)}
              style={{
                padding: '6px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                backgroundColor: i === highlighted ? 'var(--hover-md)' : 'transparent',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 700,
                  padding: '1px 3px',
                  borderRadius: 2,
                  flexShrink: 0,
                  backgroundColor: account.recoverable ? 'rgba(16,185,129,0.12)' : 'rgba(156,163,175,0.15)',
                  color: account.recoverable ? '#059669' : '#6B7280',
                }}
              >
                {account.recoverable ? 'R' : 'NR'}
              </span>
              <span style={{ color: '#3B82F6', fontFamily: 'monospace', flexShrink: 0, fontSize: 10 }}>
                {account.code}
              </span>
              <span style={{ color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {account.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
