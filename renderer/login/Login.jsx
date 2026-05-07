import { useState, useEffect } from 'react'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)
  const [mounted, setMounted]   = useState(false)

  // forgot password
  const [forgotMode, setForgotMode]     = useState(false)
  const [forgotEmail, setForgotEmail]   = useState('')
  const [forgotSent, setForgotSent]     = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError]   = useState(null)

  useEffect(() => {
    setTimeout(() => setMounted(true), 50)
  }, [])

  const handleLogin = async () => {
    if (!email || !password) return
    setLoading(true)
    setError(null)
    try {
      const result = await window.timebill.auth.login(email, password)
      if (result.error) setError(result.error)
    } catch {
      setError('Error al conectar. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin()
  }

  const handleForgot = async () => {
    if (!forgotEmail) return
    setForgotLoading(true)
    setForgotError(null)
    try {
      const result = await window.timebill.auth.forgotPassword(forgotEmail)
      if (result.error) {
        setForgotError('No se pudo enviar el email. Verificá la dirección.')
      } else {
        setForgotSent(true)
      }
    } catch {
      setForgotError('Error al conectar. Intentá de nuevo.')
    } finally {
      setForgotLoading(false)
    }
  }

  const handleForgotKey = (e) => {
    if (e.key === 'Enter') handleForgot()
  }

  const resetForgot = () => {
    setForgotMode(false)
    setForgotEmail('')
    setForgotSent(false)
    setForgotError(null)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #080a0f;
          font-family: 'DM Sans', sans-serif;
          -webkit-font-smoothing: antialiased;
          overflow: hidden;
          height: 100vh;
        }

        .page {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          position: relative;
          background: #080a0f;
        }

        .bg-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
        }
        .bg-orb-1 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, rgba(79,142,247,0.12) 0%, transparent 70%);
          top: -60px; left: -80px;
        }
        .bg-orb-2 {
          width: 200px; height: 200px;
          background: radial-gradient(circle, rgba(62,207,142,0.07) 0%, transparent 70%);
          bottom: 40px; right: -40px;
        }

        .card {
          width: 340px;
          padding: 44px 36px 36px;
          position: relative;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity .5s ease, transform .5s ease;
        }

        .card.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .brand {
          margin-bottom: 32px;
        }

        .brand-name {
          font-family: 'Syne', sans-serif;
          font-size: 26px;
          font-weight: 800;
          color: #eef0f5;
          letter-spacing: -0.5px;
          line-height: 1;
          margin-bottom: 6px;
        }

        .brand-name span {
          color: #4f8ef7;
        }

        .brand-sub {
          font-size: 12px;
          color: #4a5060;
          letter-spacing: 0.04em;
        }

        .divider {
          height: 1px;
          background: linear-gradient(90deg, #1e2230 0%, #252830 50%, transparent 100%);
          margin-bottom: 28px;
        }

        .field {
          margin-bottom: 16px;
        }

        .field-label {
          display: block;
          font-size: 10px;
          font-weight: 500;
          color: #4a5060;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .field-input {
          width: 100%;
          background: #0e1018;
          border: 1px solid #1e2230;
          border-radius: 8px;
          color: #c8cdd8;
          font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          padding: 11px 14px;
          outline: none;
          transition: border-color .2s, box-shadow .2s;
        }

        .field-input:focus {
          border-color: #4f8ef7;
          box-shadow: 0 0 0 3px rgba(79,142,247,0.08);
          color: #eef0f5;
        }

        .field-input::placeholder { color: #2a3040; }

        .error-msg {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #e5534b;
          background: rgba(229,83,75,0.06);
          border: 1px solid rgba(229,83,75,0.15);
          border-radius: 8px;
          padding: 10px 12px;
          margin-bottom: 16px;
        }

        .success-msg {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 12px;
          color: #3ecf8e;
          background: rgba(62,207,142,0.06);
          border: 1px solid rgba(62,207,142,0.15);
          border-radius: 8px;
          padding: 10px 12px;
          margin-bottom: 16px;
          line-height: 1.5;
        }

        .btn {
          width: 100%;
          padding: 12px;
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: #fff;
          background: linear-gradient(135deg, #4f8ef7 0%, #3a72d4 100%);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          margin-top: 8px;
          position: relative;
          overflow: hidden;
          transition: opacity .2s, transform .15s;
        }

        .btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 100%);
          border-radius: 8px;
        }

        .btn:hover:not(:disabled) { opacity: .9; transform: translateY(-1px); }
        .btn:active:not(:disabled) { transform: translateY(0); }
        .btn:disabled { opacity: 0.45; cursor: not-allowed; }

        .btn-inner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          position: relative;
          z-index: 1;
        }

        .spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin .7s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .forgot-link {
          display: block;
          text-align: center;
          margin-top: 16px;
          font-size: 12px;
          color: #4a5060;
          cursor: pointer;
          transition: color .2s;
          background: none;
          border: none;
          width: 100%;
          font-family: 'DM Sans', sans-serif;
        }
        .forgot-link:hover { color: #4f8ef7; }

        .section-title {
          font-family: 'Syne', sans-serif;
          font-size: 15px;
          font-weight: 700;
          color: #eef0f5;
          margin-bottom: 6px;
        }

        .section-sub {
          font-size: 12px;
          color: #4a5060;
          margin-bottom: 24px;
          line-height: 1.5;
        }
      `}</style>

      <div className="page">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />

        <div className={`card ${mounted ? 'visible' : ''}`}>
          <div className="brand">
            <div className="brand-name">Smart <span>Hours</span></div>
            <div className="brand-sub">Tracking inteligente de horas</div>
          </div>

          <div className="divider" />

          {!forgotMode ? (
            <>
              <div className="field">
                <label className="field-label">Email</label>
                <input
                  className="field-input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="tu@email.com"
                  autoFocus
                />
              </div>

              <div className="field">
                <label className="field-label">Contraseña</label>
                <input
                  className="field-input"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="error-msg">
                  <span>⚠</span> {error}
                </div>
              )}

              <button className="btn" onClick={handleLogin} disabled={loading}>
                <div className="btn-inner">
                  {loading && <div className="spinner" />}
                  {loading ? 'Ingresando…' : 'Ingresar'}
                </div>
              </button>

              <button className="forgot-link" onClick={() => setForgotMode(true)}>
                ¿Olvidaste tu contraseña?
              </button>
            </>
          ) : (
            <>
              <div className="section-title">Recuperar contraseña</div>
              <div className="section-sub">
                Te enviamos un link a tu email para crear una nueva contraseña.
              </div>

              {!forgotSent ? (
                <>
                  <div className="field">
                    <label className="field-label">Email</label>
                    <input
                      className="field-input"
                      type="email"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      onKeyDown={handleForgotKey}
                      placeholder="tu@email.com"
                      autoFocus
                    />
                  </div>

                  {forgotError && (
                    <div className="error-msg">
                      <span>⚠</span> {forgotError}
                    </div>
                  )}

                  <button className="btn" onClick={handleForgot} disabled={forgotLoading}>
                    <div className="btn-inner">
                      {forgotLoading && <div className="spinner" />}
                      {forgotLoading ? 'Enviando…' : 'Enviar link'}
                    </div>
                  </button>

                  <button className="forgot-link" onClick={resetForgot}>
                    ← Volver al login
                  </button>
                </>
              ) : (
                <>
                  <div className="success-msg">
                    <span>✓</span>
                    <span>Link enviado a <strong>{forgotEmail}</strong>. Revisá tu bandeja de entrada y seguí las instrucciones.</span>
                  </div>
                  <button className="forgot-link" onClick={resetForgot}>
                    ← Volver al login
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
