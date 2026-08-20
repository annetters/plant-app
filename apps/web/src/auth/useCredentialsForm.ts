import { useState, type FormEvent } from 'react'

interface AuthResult {
  error: { message: string } | null
}

/** Shared email/password submit-state machine behind LoginPage and SignUpPage. */
export function useCredentialsForm(action: (email: string, password: string) => Promise<AuthResult>) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent): Promise<boolean> {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const { error } = await action(email, password)
      if (error) {
        setError(error.message)
        return false
      }
      return true
    } catch {
      setError('Something went wrong. Please try again.')
      return false
    } finally {
      setSubmitting(false)
    }
  }

  return { email, setEmail, password, setPassword, error, submitting, handleSubmit }
}
