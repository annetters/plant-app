import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { RequireAuth } from '../auth/RequireAuth'
import { createMockAuthClient } from '../test/mockAuthClient'
import { SignUpPage } from './SignUpPage'

function renderSignUpFlow() {
  const mock = createMockAuthClient(null)
  render(
    <MemoryRouter initialEntries={['/signup']}>
      <AuthProvider client={mock.client}>
        <Routes>
          <Route path="/signup" element={<SignUpPage />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <div>dashboard page</div>
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
  return mock
}

describe('SignUpPage', () => {
  it('signs up with the entered email and password and shows a confirm-email message', async () => {
    const user = userEvent.setup()
    const { client } = renderSignUpFlow()

    await user.type(screen.getByLabelText(/email/i), 'new@example.com')
    await user.type(screen.getByLabelText(/password/i), 'hunter2')
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    expect(client.auth.signUp).toHaveBeenCalledWith({ email: 'new@example.com', password: 'hunter2' })
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument()
  })

  it('shows the error message when sign up fails', async () => {
    const user = userEvent.setup()
    const { client } = renderSignUpFlow()
    vi.mocked(client.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Password should be at least 6 characters' } as never,
    })

    await user.type(screen.getByLabelText(/email/i), 'new@example.com')
    await user.type(screen.getByLabelText(/password/i), 'abc')
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    expect(await screen.findByText('Password should be at least 6 characters')).toBeInTheDocument()
  })

  it('goes straight to the dashboard when the project auto-confirms email', async () => {
    const user = userEvent.setup()
    const { client, emitSession } = renderSignUpFlow()
    vi.mocked(client.auth.signUp).mockImplementation(async () => {
      emitSession({ user: { id: 'u1', email: 'new@example.com' } } as never)
      return { data: { user: null, session: null }, error: null }
    })

    await user.type(screen.getByLabelText(/email/i), 'new@example.com')
    await user.type(screen.getByLabelText(/password/i), 'hunter2')
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    expect(await screen.findByText('dashboard page')).toBeInTheDocument()
  })
})
