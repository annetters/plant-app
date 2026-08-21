import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'
import { AuthProvider } from '../auth/AuthContext'
import { createMockAuthClient } from '../test/mockAuthClient'
import { SignUpScreen } from './SignUpScreen'

// makeRedirectUri() needs Expo's runtime manifest (expo-constants), which
// isn't populated under Jest — mock the boundary rather than the plumbing.
jest.mock('expo-auth-session', () => ({
  makeRedirectUri: () => 'plant-app://redirect',
}))

const Stack = createNativeStackNavigator()

async function renderSignUpFlow(session: Parameters<typeof createMockAuthClient>[0] = null) {
  const mock = createMockAuthClient(session)
  await render(
    <AuthProvider client={mock.client}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="SignUp" component={SignUpScreen} />
          <Stack.Screen name="Login">{() => <Text>login screen</Text>}</Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </AuthProvider>,
  )
  return mock
}

describe('SignUpScreen', () => {
  it('signs up and shows the check-your-email confirmation', async () => {
    const { client } = await renderSignUpFlow(null)
    await waitFor(() => expect(screen.getByLabelText('Email')).toBeTruthy())

    await fireEvent.changeText(screen.getByLabelText('Email'), 'me@example.com')
    await fireEvent.changeText(screen.getByLabelText('Password'), 'hunter22')
    await fireEvent.press(screen.getByRole('button', { name: 'Sign up' }))

    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: 'me@example.com',
      password: 'hunter22',
      options: { emailRedirectTo: 'plant-app://redirect' },
    })
    expect(await screen.findByText('Check your email')).toBeTruthy()
  })

  it('shows the error message when signup fails', async () => {
    const { client } = await renderSignUpFlow(null)
    jest.mocked(client.auth.signUp).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'User already registered' } as never,
    })
    await waitFor(() => expect(screen.getByLabelText('Email')).toBeTruthy())

    await fireEvent.changeText(screen.getByLabelText('Email'), 'me@example.com')
    await fireEvent.changeText(screen.getByLabelText('Password'), 'hunter22')
    await fireEvent.press(screen.getByRole('button', { name: 'Sign up' }))

    expect(await screen.findByText('User already registered')).toBeTruthy()
  })

  it('navigates to Log in', async () => {
    await renderSignUpFlow(null)
    await waitFor(() => expect(screen.getByText('Already have an account? Log in')).toBeTruthy())

    await fireEvent.press(screen.getByText('Already have an account? Log in'))

    expect(await screen.findByText('login screen')).toBeTruthy()
  })
})
