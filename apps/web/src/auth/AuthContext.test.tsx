import { act, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createMockAuthClient } from '../test/mockAuthClient'
import { AuthProvider, useAuth } from './AuthContext'

function Probe() {
  const auth = useAuth()
  const [lastError, setLastError] = useState<string>('none')
  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="email">{auth.user?.email ?? 'none'}</span>
      <span data-testid="error">{lastError}</span>
      <button onClick={() => auth.signUp('new@example.com', 'hunter2')}>signup</button>
      <button
        onClick={async () => {
          const result = await auth.logIn('new@example.com', 'hunter2')
          setLastError(result.error?.message ?? 'none')
        }}
      >
        login
      </button>
      <button onClick={() => auth.logOut()}>logout</button>
    </div>
  )
}

describe('AuthProvider / useAuth', () => {
  it('starts loading, then becomes unauthenticated when there is no session', async () => {
    const { client } = createMockAuthClient(null)
    render(
      <AuthProvider client={client}>
        <Probe />
      </AuthProvider>,
    )

    expect(screen.getByTestId('status')).toHaveTextContent('loading')
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))
  })

  it('starts authenticated when the client reports an existing session', async () => {
    const { client } = createMockAuthClient({
      user: { id: 'u1', email: 'me@example.com' },
    } as never)
    render(
      <AuthProvider client={client}>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    expect(screen.getByTestId('email')).toHaveTextContent('me@example.com')
  })

  it('becomes authenticated when the client later reports a session', async () => {
    const { client, emitSession } = createMockAuthClient(null)
    render(
      <AuthProvider client={client}>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))

    act(() => {
      emitSession({ user: { id: 'u1', email: 'me@example.com' } } as never)
    })

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    expect(screen.getByTestId('email')).toHaveTextContent('me@example.com')
  })

  it('delegates signUp, logIn, and logOut to the underlying client', async () => {
    const { client } = createMockAuthClient(null)
    render(
      <AuthProvider client={client}>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))

    await act(async () => {
      screen.getByText('signup').click()
    })
    expect(client.auth.signUp).toHaveBeenCalledWith({ email: 'new@example.com', password: 'hunter2' })

    await act(async () => {
      screen.getByText('login').click()
    })
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'hunter2',
    })

    await act(async () => {
      screen.getByText('logout').click()
    })
    expect(client.auth.signOut).toHaveBeenCalledOnce()
  })

  it('surfaces an error from the client instead of throwing', async () => {
    const { client } = createMockAuthClient(null)
    vi.mocked(client.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { name: 'AuthApiError', message: 'Invalid login credentials' } as never,
    })
    render(
      <AuthProvider client={client}>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))

    await act(async () => {
      screen.getByText('login').click()
    })
    expect(screen.getByTestId('error')).toHaveTextContent('Invalid login credentials')
  })

  it('does not throw when signOut rejects, and leaves state untouched', async () => {
    const { client } = createMockAuthClient({ user: { id: 'u1', email: 'me@example.com' } } as never)
    vi.mocked(client.auth.signOut).mockRejectedValueOnce(new Error('network error'))
    render(
      <AuthProvider client={client}>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))

    await act(async () => {
      screen.getByText('logout').click()
    })

    expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
  })
})
