import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AppLayout } from './AppLayout'
import { AuthPage } from '../features/auth/AuthPage'
import { signOut } from '../features/auth/authService'

export function AuthGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return
      setSession(data.session)
      setIsLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function handleSignOut() {
    await signOut()
  }

  if (isLoading) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="auth-logo">KOAJ</div>
          <div className="auth-subtitle">Cargando sesión...</div>
        </section>
      </main>
    )
  }

  if (!session) {
    return <AuthPage />
  }

  return (
    <AppLayout
      userEmail={session.user.email ?? 'usuario autenticado'}
      onSignOut={handleSignOut}
    />
  )
}
