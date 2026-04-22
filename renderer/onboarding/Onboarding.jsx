import { useState, useEffect } from 'react'

const STEPS = [
  {
    icon: '⚙️',
    title: 'Configurá tus clientes',
    desc: 'Agregá el nombre, tarifa por hora y palabras clave de cada cliente. Smart Hours las usa para detectar automáticamente en qué estás trabajando.',
    action: null,
  },
  {
    icon: '🖥️',
    title: 'Trabajá normalmente',
    desc: 'Abrí cualquier documento, email o ventana relacionada a un cliente. Smart Hours lo detecta y empieza a trackear el tiempo por vos.',
    action: null,
  },
  {
    icon: '📊',
    title: 'Revisá tus horas',
    desc: 'Abrí el dashboard para ver el resumen de horas por cliente, período y origen. Desde ahí podés generar reportes en PDF y enviarlos por WhatsApp.',
    action: null,
  },
]

export default function Onboarding() {
  const [step, setStep]     = useState(0)
  const [mounted, setMounted] = useState(false)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    setTimeout(() => setMounted(true), 50)
  }, [])

  const goTo = (next) => {
    setAnimating(true)
    setTimeout(() => {
      setStep(next)
      setAnimating(false)
    }, 180)
  }

  const handleFinish = () => {
    window.timebill.app.closeOnboarding()
  }

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #080a0f;
          font-family: 'DM Sans', sans-serif;
          -webkit-font-smoothing: antialiased;
          overflow: hidden;
          height: 100vh;
          user-select: none;
        }

        .page {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #080a0f;
          padding: 36px 40px 32px;
          position: relative;
          opacity: 0;
          transform: translateY(12px);
          transition: opacity .4s ease, transform .4s ease;
        }
        .page.visible { opacity: 1; transform: translateY(0); }

        .bg-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          pointer-events: none;
        }
        .bg-orb-1 {
          width: 350px; height: 350px;
          background: radial-gradient(circle, rgba(79,142,247,0.09) 0%, transparent 70%);
          top: -80px; right: -60px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 40px;
        }
        .brand-name {
          font-family: 'Syne', sans-serif;
          font-size: 16px;
          font-weight: 700;
          color: #eef0f5;
        }
        .brand-name span { color: #4f8ef7; }

        .step-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          transition: opacity .18s ease, transform .18s ease;
        }
        .step-content.animating { opacity: 0; transform: translateX(12px); }

        .step-icon {
          font-size: 48px;
          margin-bottom: 24px;
          line-height: 1;
        }

        .step-title {
          font-family: 'Syne', sans-serif;
          font-size: 22px;
          font-weight: 700;
          color: #eef0f5;
          margin-bottom: 14px;
          line-height: 1.2;
        }

        .step-desc {
          font-size: 14px;
          color: #6b7180;
          line-height: 1.65;
          max-width: 360px;
        }

        .bottom {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .dots {
          display: flex;
          gap: 6px;
          justify-content: center;
        }
        .dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #1e2230;
          transition: background .2s, width .2s;
        }
        .dot.active {
          background: #4f8ef7;
          width: 20px;
          border-radius: 3px;
        }

        .btn-row {
          display: flex;
          gap: 10px;
        }

        .btn-back {
          flex: 0 0 auto;
          padding: 12px 20px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: #4a5060;
          background: none;
          border: 1px solid #1e2230;
          border-radius: 8px;
          cursor: pointer;
          transition: color .15s, border-color .15s;
        }
        .btn-back:hover { color: #c8cdd8; border-color: #3a3e4a; }

        .btn-next {
          flex: 1;
          padding: 12px;
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          background: linear-gradient(135deg, #4f8ef7 0%, #3a72d4 100%);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: opacity .15s, transform .15s;
        }
        .btn-next::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 100%);
        }
        .btn-next:hover { opacity: .9; transform: translateY(-1px); }
        .btn-next.finish { background: linear-gradient(135deg, #3ecf8e 0%, #2aaa72 100%); }

        .skip {
          text-align: center;
          font-size: 11px;
          color: #2a3040;
          cursor: pointer;
          transition: color .15s;
        }
        .skip:hover { color: #4a5060; }
      `}</style>

      <div className={`page ${mounted ? 'visible' : ''}`}>
        <div className="bg-orb bg-orb-1" />

        <div className="brand">
          <span className="brand-name">Smart <span>Hours</span></span>
        </div>

        <div className={`step-content ${animating ? 'animating' : ''}`}>
          <div className="step-icon">{current.icon}</div>
          <div className="step-title">{current.title}</div>
          <div className="step-desc">{current.desc}</div>
        </div>

        <div className="bottom">
          <div className="dots">
            {STEPS.map((_, i) => (
              <div key={i} className={`dot ${i === step ? 'active' : ''}`} />
            ))}
          </div>

          <div className="btn-row">
            {step > 0 && (
              <button className="btn-back" onClick={() => goTo(step - 1)}>
                ← Atrás
              </button>
            )}
            <button
              className={`btn-next ${isLast ? 'finish' : ''}`}
              onClick={() => isLast ? handleFinish() : goTo(step + 1)}
            >
              {isLast ? '¡Empezar!' : 'Siguiente →'}
            </button>
          </div>

          {!isLast && (
            <div className="skip" onClick={handleFinish}>Saltar introducción</div>
          )}
        </div>
      </div>
    </>
  )
}
