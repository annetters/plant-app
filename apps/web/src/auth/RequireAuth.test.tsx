import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { createMockAuthClient } from '../test/mockAuthClient'
import { AuthProvider } from './AuthContext'
import { RequireAuth } from './RequireAuth'

function renderAt(path: string, session: Parameters<typeof createMockAuthClient>[0]) {
  const { client } = createMockAuthClient(session)
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider client={client}>
        <Routes>
          <Route path="/login" element={<div>login page</div>} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <div>dashboard content</div>
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('RequireAuth', () => {
  it('redirects to /login when there is no session', async () => {
    renderAt('/dashboard', null)
    expect(await screen.findByText('login page')).toBeInTheDocument()
  })

  it('renders its children once a session is present', async () => {
    renderAt('/dashboard', { user: { id: 'u1', email: 'me@example.com' } } as never)
    expect(await screen.findByText('dashboard content')).toBeInTheDocument()
  })
})
