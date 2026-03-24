import { useTheme } from '../context/ThemeContext'

const DARK = {
  'Uploaded':          { bg: 'rgba(107,114,128,0.12)', color: '#9CA3AF',  border: 'rgba(107,114,128,0.3)', dot: '#9CA3AF' },
  'Processing':        { bg: 'rgba(59,130,246,0.12)',  color: '#60A5FA',  border: 'rgba(59,130,246,0.3)',  dot: '#3B82F6' },
  'Classified':        { bg: 'rgba(59,130,246,0.12)',  color: '#60A5FA',  border: 'rgba(59,130,246,0.3)',  dot: '#3B82F6' },
  'Awaiting Approval': { bg: 'rgba(245,158,11,0.12)',  color: '#FCD34D',  border: 'rgba(245,158,11,0.3)',  dot: '#F59E0B' },
  'Under Review':      { bg: 'rgba(245,158,11,0.12)',  color: '#FCD34D',  border: 'rgba(245,158,11,0.3)',  dot: '#F59E0B' },
  'Approved':          { bg: 'rgba(16,185,129,0.12)',  color: '#6EE7B7',  border: 'rgba(16,185,129,0.3)',  dot: '#10B981' },
  'Flagged':           { bg: 'rgba(239,68,68,0.12)',   color: '#FCA5A5',  border: 'rgba(239,68,68,0.3)',   dot: '#EF4444' },
  'Payment Scheduled': { bg: 'rgba(139,92,246,0.12)',  color: '#C4B5FD',  border: 'rgba(139,92,246,0.3)',  dot: '#8B5CF6' },
  'Paid':              { bg: 'rgba(16,185,129,0.12)',  color: '#6EE7B7',  border: 'rgba(16,185,129,0.3)',  dot: '#10B981' },
  'Filed':             { bg: 'rgba(107,114,128,0.12)', color: '#9CA3AF',  border: 'rgba(107,114,128,0.3)', dot: '#9CA3AF' },
}

const LIGHT = {
  'Uploaded':          { bg: 'rgba(100,116,139,0.1)',  color: '#475569',  border: 'rgba(100,116,139,0.25)', dot: '#64748B' },
  'Processing':        { bg: 'rgba(37,99,235,0.1)',    color: '#1D4ED8',  border: 'rgba(37,99,235,0.25)',   dot: '#2563EB' },
  'Classified':        { bg: 'rgba(37,99,235,0.1)',    color: '#1D4ED8',  border: 'rgba(37,99,235,0.25)',   dot: '#2563EB' },
  'Awaiting Approval': { bg: 'rgba(217,119,6,0.1)',    color: '#92400E',  border: 'rgba(217,119,6,0.25)',   dot: '#D97706' },
  'Under Review':      { bg: 'rgba(217,119,6,0.1)',    color: '#92400E',  border: 'rgba(217,119,6,0.25)',   dot: '#D97706' },
  'Approved':          { bg: 'rgba(5,150,105,0.1)',    color: '#065F46',  border: 'rgba(5,150,105,0.25)',   dot: '#059669' },
  'Flagged':           { bg: 'rgba(220,38,38,0.1)',    color: '#991B1B',  border: 'rgba(220,38,38,0.25)',   dot: '#DC2626' },
  'Payment Scheduled': { bg: 'rgba(109,40,217,0.1)',   color: '#5B21B6',  border: 'rgba(109,40,217,0.25)',  dot: '#6D28D9' },
  'Paid':              { bg: 'rgba(5,150,105,0.1)',    color: '#065F46',  border: 'rgba(5,150,105,0.25)',   dot: '#059669' },
  'Filed':             { bg: 'rgba(100,116,139,0.1)',  color: '#475569',  border: 'rgba(100,116,139,0.25)', dot: '#64748B' },
}

export default function StatusBadge({ status }) {
  const { isDark } = useTheme()
  const map = isDark ? DARK : LIGHT
  const c = map[status] || map['Uploaded']

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}` }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.dot }} />
      {status}
    </span>
  )
}
