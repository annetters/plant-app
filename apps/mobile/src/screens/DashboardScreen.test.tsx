import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { AuthProvider } from '../auth/AuthContext'
import { createMockAuthClient } from '../test/mockAuthClient'
import { DashboardScreen } from './DashboardScreen'

const Stack = createNativeStackNavigator()

function renderDashboard(client: ReturnType<typeof createMockAuthClient>['client']) {
  return render(
    <AuthProvider client={client}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="Registry">{() => <Text>registry screen</Text>}</Stack.Screen>
          <Stack.Screen name="BloomTimeline">{() => <Text>bloom timeline screen</Text>}</Stack.Screen>
          <Stack.Screen name="TagScanCapture">{() => <Text>tag scan capture screen</Text>}</Stack.Screen>
          <Stack.Screen name="Tasks">{() => <Text>tasks screen</Text>}</Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </AuthProvider>,
  )
}

describe('DashboardScreen', () => {
  it('shows a tile for each of Map, Registry, and Bloom Timeline', async () => {
    const { client } = createMockAuthClient(null)
    await renderDashboard(client)

    for (const label of ['Map', 'Registry', 'Bloom Timeline']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
  })

  it('navigates to the Registry screen when the Registry tile is pressed', async () => {
    const { client } = createMockAuthClient(null)
    await renderDashboard(client)

    await fireEvent.press(screen.getByRole('button', { name: 'Registry' }))

    expect(await screen.findByText('registry screen')).toBeTruthy()
  })

  it('navigates to the Bloom Timeline screen when the Bloom Timeline tile is pressed', async () => {
    const { client } = createMockAuthClient(null)
    await renderDashboard(client)

    await fireEvent.press(screen.getByRole('button', { name: 'Bloom Timeline' }))

    expect(await screen.findByText('bloom timeline screen')).toBeTruthy()
  })

  it('logs out when the Log out button is pressed', async () => {
    const { client } = createMockAuthClient({ user: { id: 'u1', email: 'me@example.com' } } as never)
    await renderDashboard(client)

    await fireEvent.press(screen.getByRole('button', { name: 'Log out' }))

    expect(client.auth.signOut).toHaveBeenCalledTimes(1)
  })

  it('navigates to the tag scan capture screen when "Scan a tag" is pressed', async () => {
    const { client } = createMockAuthClient(null)
    await renderDashboard(client)

    await fireEvent.press(screen.getByRole('button', { name: 'Scan a tag' }))

    expect(await screen.findByText('tag scan capture screen')).toBeTruthy()
  })

  it('navigates to the Tasks screen via its plain link, not a tile', async () => {
    const { client } = createMockAuthClient(null)
    await renderDashboard(client)

    await fireEvent.press(screen.getByRole('button', { name: 'Tasks & To-dos' }))

    expect(await screen.findByText('tasks screen')).toBeTruthy()
  })
})
