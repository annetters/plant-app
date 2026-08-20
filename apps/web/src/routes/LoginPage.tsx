import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useCredentialsForm } from '../auth/useCredentialsForm'
import { useRedirectIfAuthenticated } from '../auth/useRedirectIfAuthenticated'

export function LoginPage() {
  const { logIn } = useAuth()
  useRedirectIfAuthenticated('/dashboard')
  const form = useCredentialsForm(logIn)

  return (
    <main>
      <h1>Log in</h1>
      <form onSubmit={form.handleSubmit}>
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(event) => form.setEmail(event.target.value)}
        />

        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={form.password}
          onChange={(event) => form.setPassword(event.target.value)}
        />

        {form.error && <p role="alert">{form.error}</p>}

        <button type="submit" disabled={form.submitting}>
          Log in
        </button>
      </form>
      <p>
        Don't have an account? <Link to="/signup">Sign up</Link>
      </p>
    </main>
  )
}
