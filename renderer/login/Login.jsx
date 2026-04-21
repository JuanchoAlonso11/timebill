import { useState } from 'react'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)

  const handleLogin = async () => {
    if (!email || !password) return
    setLoading(true)
    setError(null)
    try {
      const result = await window.timebill.auth.login(email, password)
      if (result.error) {
        setError('Email o contraseña incorrectos.')
      }
    } catch (e) {
      setError('Error al conectar. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>TimeBill</div>
        <div style={s.sub}>Registro de horas profesionales</div>

        <div style={s.field}>
          <label style={s.label}>Email</label>
          <input
            style={s.input}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="tu@email.com"
            autoFocus
          />
        </div>

        <div style={s.field}>
          <label style={s.label}>Contraseña</label>
          <input
            style={s.input}
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="••••••••"
          />
        </div>

        {error && <div style={s.error}>{error}</div>}

        <button
          style={{ ...s.btn, ...(loading ? s.btnDisabled : {}) }}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </div>
    </div>
  )
}

const s = {
  page: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: '#0e0f11',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    WebkitFontSmoothing: 'antialiased',
  },
  card: {
    background: '#16181c',
    border: '1px solid #252830',
    borderRadius: '8px',
    padding: '36px 32px',
    width: '320px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  logo: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#4f8ef7',
    letterSpacing: '-0.5px',
  },
  sub: {
    fontSize: '12px',
    color: '#6b7180',
    marginTop: '-8px',
    marginBottom: '8px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '11px',
    fontWeight: '500',
    color: '#6b7180',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  input: {
    background: '#0e0f11',
    border: '1px solid #252830',
    borderRadius: '6px',
    color: '#eef0f5',
    fontSize: '13px',
    padding: '9px 12px',
    outline: 'none',
    fontFamily: 'inherit',
  },
  error: {
    fontSize: '12px',
    color: '#e5534b',
    background: '#2a1412',
    border: '1px solid #4a2020',
    borderRadius: '6px',
    padding: '8px 12px',
  },
  btn: {
    background: '#4f8ef7',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '10px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '4px',
    fontFamily: 'inherit',
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
}
