import { fireEvent, render, screen } from '@testing-library/react-native'
import { AuthProvider } from '../auth/AuthContext'
import { createMockAuthClient } from '../test/mockAuthClient'
import { DashboardScreen } from './DashboardScreen'

describe('DashboardScreen', () => {
  it('shows a placeholder tile for each of Map, Registry, and Bloom Timeline', async () => {
    const { client } = createMockAuthClient(null)
    await render(
      <AuthProvider client={client}>
        <DashboardScreen />
      </AuthProvider>,
    )

    for (const label of ['Map', 'Registry', 'Bloom Timeline']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
  })

  it('logs out when the Log out button is pressed', async () => {
    const { client } = createMockAuthClient({ user: { id: 'u1', email: 'me@example.com' } } as never)
    await render(
      <AuthProvider client={client}>
        <DashboardScreen />
      </AuthProvider>,
    )

    await fireEvent.press(screen.getByRole('button', { name: 'Log out' }))

    expect(client.auth.signOut).toHaveBeenCalledTimes(1)
  })
})
