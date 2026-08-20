import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

/**
 * Sends the user to `to` once auth status becomes 'authenticated' — driven
 * by AuthContext's own state rather than a submit handler's promise
 * resolving, so it also covers signup flows that auto-create a session
 * (email confirmation disabled) and an already-logged-in user landing on
 * /login or /signup directly.
 */
export function useRedirectIfAuthenticated(to: string) {
  const { status } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (status === 'authenticated') {
      navigate(to, { replace: true })
    }
  }, [status, navigate, to])
}
