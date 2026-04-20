export default function PortfolioTabs({ tabs = [], selected, onChange, className = '' }) {
  if (!tabs.length) return null

  return (
    <div className={`flex flex-wrap gap-1 ${className}`.trim()}>
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange?.(tab.key)}
          className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
          style={{
            backgroundColor: selected === tab.key ? 'rgba(37,99,235,0.12)' : 'transparent',
            color: selected === tab.key ? '#2563EB' : 'var(--text-5)',
            border: selected === tab.key ? '1px solid rgba(37,99,235,0.25)' : '1px solid transparent',
          }}
        >
          {tab.label}
          {typeof tab.count === 'number' ? ` · ${tab.count}` : ''}
        </button>
      ))}
    </div>
  )
}
