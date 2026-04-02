import { useState } from 'react'
import { Mail, ArrowRight, CheckCircle, Loader } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export default function LoginScreen() {
  const { signIn } = useAuth()
  const { isDark } = useTheme()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('sending')
    const { error } = await signIn(email.trim().toLowerCase())
    if (error) {
      setErrorMsg(error.message)
      setStatus('error')
    } else {
      setStatus('sent')
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--bg)', fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', boxShadow: '0 0 0 1px rgba(59,130,246,0.3)' }}
          >
            <span className="text-sm font-bold text-white tracking-tight">OF</span>
          </div>
          <span className="text-xl font-semibold" style={{ color: 'var(--text-1)', letterSpacing: '-0.03em' }}>
            OpsFlow
          </span>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: isDark
              ? '0 24px 64px rgba(0,0,0,0.5)'
              : '0 8px 32px rgba(0,0,0,0.12)',
          }}
        >
          {status === 'sent' ? (
            <div className="p-8 text-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'rgba(16,185,129,0.12)' }}
              >
                <CheckCircle size={28} style={{ color: '#10B981' }} />
              </div>
              <h2 className="font-semibold mb-2" style={{ color: 'var(--text-1)', fontSize: '17px' }}>
                Check your email
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-5)' }}>
                We sent a sign-in link to <strong style={{ color: 'var(--text-3)' }}>{email}</strong>.
                Click it to access OpsFlow.
              </p>
              <button
                onClick={() => setStatus('idle')}
                className="mt-5 text-xs"
                style={{ color: 'var(--text-5)' }}
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="mb-1">
                <h2 className="font-semibold mb-1" style={{ color: 'var(--text-1)', fontSize: '17px', letterSpacing: '-0.02em' }}>
                  Sign in to OpsFlow
                </h2>
                <p className="text-xs" style={{ color: 'var(--text-5)' }}>
                  Invoice operations for your property team
                </p>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-4)' }}>
                  Work email
                </label>
                <div
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5"
                  style={{
                    backgroundColor: 'var(--surface-alt)',
                    border: `1px solid ${status === 'error' ? 'rgba(239,68,68,0.5)' : 'var(--border-strong)'}`,
                  }}
                >
                  <Mail size={14} style={{ color: 'var(--text-6)', flexShrink: 0 }} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); if (status === 'error') setStatus('idle') }}
                    placeholder="you@yourcompany.com"
                    required
                    autoFocus
                    className="bg-transparent outline-none flex-1 text-sm"
                    style={{ color: 'var(--text-2)' }}
                  />
                </div>
                {status === 'error' && (
                  <p className="text-xs mt-1.5" style={{ color: '#EF4444' }}>{errorMsg}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={status === 'sending' || !email.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{
                  backgroundColor: status === 'sending' ? 'rgba(37,99,235,0.7)' : '#1D4ED8',
                  color: 'white',
                  opacity: !email.trim() ? 0.6 : 1,
                  cursor: !email.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {status === 'sending'
                  ? <><Loader size={14} className="spin-slow" /> Sending link…</>
                  : <><span>Send magic link</span><ArrowRight size={14} /></>
                }
              </button>

              <p className="text-center text-xs" style={{ color: 'var(--text-6)' }}>
                No password required — we'll email you a one-click link.
              </p>
            </form>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-7)' }}>
          Internal tool · Premier Properties Operations
        </p>
      </div>
    </div>
  )
}
