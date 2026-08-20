import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useCredentialsForm } from '../auth/useCredentialsForm'
import { useRedirectIfAuthenticated } from '../auth/useRedirectIfAuthenticated'

export function SignUpPage() {
  const { signUp } = useAuth()
  useRedirectIfAuthenticated('/dashboard')
  const [submitted, setSubmitted] = useState(false)
  const form = useCredentialsForm(async (email, password) => {
    const result = await signUp(email, password)
    if (!result.error) {
      setSubmitted(true)
    }
    return result
  })

  if (submitted) {
    return (
      <main>
        <h1>Check your email</h1>
        <p>We sent a confirmation link to {form.email}. Follow it to finish signing up.</p>
      </main>
    )
  }

  return (
    <main>
      <h1>Sign up</h1>
      <form onSubmit={form.handleSubmit}>
        <label htmlFor="signup-email">Email</label>
        <input
          id="signup-email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(event) => form.setEmail(event.target.value)}
        />

        <label htmlFor="signup-password">Password</label>
        <input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={form.password}
          onChange={(event) => form.setPassword(event.target.value)}
        />

        {form.error && <p role="alert">{form.error}</p>}

        <button type="submit" disabled={form.submitting}>
          Sign up
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </main>
  )
}
