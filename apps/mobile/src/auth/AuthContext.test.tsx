import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { createMockAuthClient } from '../test/mockAuthClient'
import { AuthProvider, useAuth } from './AuthContext'

function Probe() {
  const auth = useAuth()
  const [lastError, setLastError] = useState<string>('none')
  return (
    <View>
      <Text testID="status">{auth.status}</Text>
      <Text testID="email">{auth.user?.email ?? 'none'}</Text>
      <Text testID="error">{lastError}</Text>
      <Pressable onPress={() => auth.signUp('new@example.com', 'hunter2')}>
        <Text>signup</Text>
      </Pressable>
      <Pressable
        onPress={() =>
          auth.signUp('new@example.com', 'hunter2', { emailRedirectTo: 'plant-app://redirect' })
        }
      >
        <Text>signup-with-redirect</Text>
      </Pressable>
      <Pressable
        onPress={async () => {
          const result = await auth.logIn('new@example.com', 'hunter2')
          setLastError(result.error?.message ?? 'none')
        }}
      >
        <Text>login</Text>
      </Pressable>
      <Pressable onPress={() => auth.logOut()}>
        <Text>logout</Text>
      </Pressable>
    </View>
  )
}

describe('AuthProvider / useAuth', () => {
  it('becomes unauthenticated when there is no session', async () => {
    const { client } = createMockAuthClient(null)
    await render(
      <AuthProvider client={client}>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))
  })

  it('starts authenticated when the client reports an existing session', async () => {
    const { client } = createMockAuthClient({
      user: { id: 'u1', email: 'me@example.com' },
    } as never)
    await render(
      <AuthProvider client={client}>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    expect(screen.getByTestId('email')).toHaveTextContent('me@example.com')
  })

  it('becomes authenticated when the client later reports a session', async () => {
    const { client, emitSession } = createMockAuthClient(null)
    await render(
      <AuthProvider client={client}>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))

    await act(() => {
      emitSession({ user: { id: 'u1', email: 'me@example.com' } } as never)
    })

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    expect(screen.getByTestId('email')).toHaveTextContent('me@example.com')
  })

  it('delegates signUp, logIn, and logOut to the underlying client', async () => {
    const { client } = createMockAuthClient(null)
    await render(
      <AuthProvider client={client}>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))

    await act(async () => {
      fireEvent.press(screen.getByText('signup'))
    })
    expect(client.auth.signUp).toHaveBeenCalledWith({ email: 'new@example.com', password: 'hunter2' })

    await act(async () => {
      fireEvent.press(screen.getByText('login'))
    })
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'hunter2',
    })

    await act(async () => {
      fireEvent.press(screen.getByText('logout'))
    })
    expect(client.auth.signOut).toHaveBeenCalledTimes(1)
  })

  it('surfaces an error from the client instead of throwing', async () => {
    const { client } = createMockAuthClient(null)
    jest.mocked(client.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { name: 'AuthApiError', message: 'Invalid login credentials' } as never,
    })
    await render(
      <AuthProvider client={client}>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))

    await act(async () => {
      fireEvent.press(screen.getByText('login'))
    })
    expect(screen.getByTestId('error')).toHaveTextContent('Invalid login credentials')
  })

  it('does not throw when signOut rejects, and leaves state untouched', async () => {
    const { client } = createMockAuthClient({ user: { id: 'u1', email: 'me@example.com' } } as never)
    jest.mocked(client.auth.signOut).mockRejectedValueOnce(new Error('network error'))
    await render(
      <AuthProvider client={client}>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))

    await act(async () => {
      fireEvent.press(screen.getByText('logout'))
    })

    expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
  })

  it('forwards emailRedirectTo to the client when signUp is given options', async () => {
    const { client } = createMockAuthClient(null)
    await render(
      <AuthProvider client={client}>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))

    await act(async () => {
      fireEvent.press(screen.getByText('signup-with-redirect'))
    })
    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'hunter2',
      options: { emailRedirectTo: 'plant-app://redirect' },
    })
  })
})
