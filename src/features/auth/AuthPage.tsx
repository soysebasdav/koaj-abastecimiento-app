import { FormEvent, useState } from 'react'
import { signInWithEmailPassword, signUpWithEmailPassword } from './authService'

type AuthMode = 'sign-in' | 'sign-up'

export function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setFeedback(null)
    setIsSubmitting(true)

    try {
      if (mode === 'sign-in') {
        await signInWithEmailPassword(email, password)
        setFeedback('Sesión iniciada correctamente.')
      } else {
        await signUpWithEmailPassword(email, password)
        setFeedback('Usuario creado. Si Supabase exige confirmación, revisa el correo antes de iniciar sesión.')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No fue posible autenticar el usuario.'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">KOAJ</div>
          <div className="auth-subtitle">Planeación de Abastecimiento</div>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'sign-in' ? 'active' : ''}
            onClick={() => setMode('sign-in')}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            className={mode === 'sign-up' ? 'active' : ''}
            onClick={() => setMode('sign-up')}
          >
            Crear usuario
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Correo</label>
            <input
              id="email"
              className="form-control"
              type="email"
              autoComplete="email"
              placeholder="usuario@koaj.co"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              className="form-control"
              type="password"
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
            />
          </div>

          {error ? <div className="auth-alert error">{error}</div> : null}
          {feedback ? <div className="auth-alert success">{feedback}</div> : null}

          <button className="btn btn-primary auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Procesando...' : mode === 'sign-in' ? 'Ingresar' : 'Crear usuario'}
          </button>
        </form>

        <div className="auth-note">
          La base de datos usa RLS para usuarios autenticados. Sin sesión activa, la app no debe leer ni escribir información operativa.
        </div>
      </section>
    </main>
  )
}
