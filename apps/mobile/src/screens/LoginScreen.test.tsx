import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'
import { AuthProvider } from '../auth/AuthContext'
import { createMockAuthClient } from '../test/mockAuthClient'
import { LoginScreen } from './LoginScreen'

const Stack = createNativeStackNavigator()

async function renderLoginFlow(session: Parameters<typeof createMockAuthClient>[0] = null) {
  const mock = createMockAuthClient(session)
  await render(
    <AuthProvider client={mock.client}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="SignUp">{() => <Text>signup screen</Text>}</Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </AuthProvider>,
  )
  return mock
}

describe('LoginScreen', () => {
  it('logs in with the entered email and password', async () => {
    const { client } = await renderLoginFlow(null)
    await waitFor(() => expect(screen.getByLabelText('Email')).toBeTruthy())

    await fireEvent.changeText(screen.getByLabelText('Email'), 'me@example.com')
    await fireEvent.changeText(screen.getByLabelText('Password'), 'hunter2')
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }))

    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'me@example.com',
      password: 'hunter2',
    })
  })

  it('shows the error message when login fails', async () => {
    const { client } = await renderLoginFlow(null)
    jest.mocked(client.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' } as never,
    })
    await waitFor(() => expect(screen.getByLabelText('Email')).toBeTruthy())

    await fireEvent.changeText(screen.getByLabelText('Email'), 'me@example.com')
    await fireEvent.changeText(screen.getByLabelText('Password'), 'wrong')
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByText('Invalid login credentials')).toBeTruthy()
  })

  it('navigates to Sign up', async () => {
    await renderLoginFlow(null)
    await waitFor(() => expect(screen.getByText("Don't have an account? Sign up")).toBeTruthy())

    await fireEvent.press(screen.getByText("Don't have an account? Sign up"))

    expect(await screen.findByText('signup screen')).toBeTruthy()
  })
})
