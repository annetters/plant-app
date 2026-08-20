import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { RequireAuth } from '../auth/RequireAuth'
import { createMockAuthClient } from '../test/mockAuthClient'
import { LoginPage } from './LoginPage'

function renderLoginFlow(session: Parameters<typeof createMockAuthClient>[0] = null) {
  const mock = createMockAuthClient(session)
  render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider client={mock.client}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
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

describe('LoginPage', () => {
  it('logs in with the entered email and password and lands on the dashboard', async () => {
    const user = userEvent.setup()
    const { client, emitSession } = renderLoginFlow(null)
    vi.mocked(client.auth.signInWithPassword).mockImplementation(async () => {
      emitSession({ user: { id: 'u1', email: 'me@example.com' } } as never)
      return { data: { user: null, session: null }, error: null }
    })

    await user.type(screen.getByLabelText(/email/i), 'me@example.com')
    await user.type(screen.getByLabelText(/password/i), 'hunter2')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'me@example.com',
      password: 'hunter2',
    })
    expect(await screen.findByText('dashboard page')).toBeInTheDocument()
  })

  it('shows the error message when login fails', async () => {
    const user = userEvent.setup()
    const { client } = renderLoginFlow(null)
    vi.mocked(client.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' } as never,
    })

    await user.type(screen.getByLabelText(/email/i), 'me@example.com')
    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText('Invalid login credentials')).toBeInTheDocument()
  })

  it('redirects straight to the dashboard if already authenticated', async () => {
    renderLoginFlow({ user: { id: 'u1', email: 'me@example.com' } } as never)
    expect(await screen.findByText('dashboard page')).toBeInTheDocument()
  })
})
