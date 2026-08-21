import { NavigationContainer } from '@react-navigation/native'
import { act, render, screen, waitFor } from '@testing-library/react-native'
import { AuthProvider } from '../auth/AuthContext'
import { createMockAuthClient } from '../test/mockAuthClient'
import { RootNavigator } from './RootNavigator'

async function renderWithSession(session: Parameters<typeof createMockAuthClient>[0]) {
  const mock = createMockAuthClient(session)
  await render(
    <AuthProvider client={mock.client}>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>,
  )
  return mock
}

describe('RootNavigator', () => {
  it('shows the Login screen when there is no session', async () => {
    await renderWithSession(null)
    await waitFor(() => expect(screen.getByText("Don't have an account? Sign up")).toBeTruthy())
  })

  it('shows the Dashboard once a session is present', async () => {
    await renderWithSession({ user: { id: 'u1', email: 'me@example.com' } } as never)
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeTruthy())
  })

  it('switches from Login to Dashboard when the session arrives later', async () => {
    const { emitSession } = await renderWithSession(null)
    await waitFor(() => expect(screen.getByText("Don't have an account? Sign up")).toBeTruthy())

    await act(() => {
      emitSession({ user: { id: 'u1', email: 'me@example.com' } } as never)
    })

    await waitFor(() => expect(screen.getByText('Dashboard')).toBeTruthy())
  })
})
