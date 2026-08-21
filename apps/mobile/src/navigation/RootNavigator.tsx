import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuth } from '../auth/AuthContext'
import { DashboardScreen } from '../screens/DashboardScreen'
import { LoadingScreen } from '../screens/LoadingScreen'
import { LoginScreen } from '../screens/LoginScreen'
import { SignUpScreen } from '../screens/SignUpScreen'
import type { AuthStackParamList, MainStackParamList } from './types'

const AuthStack = createNativeStackNavigator<AuthStackParamList>()
const MainStack = createNativeStackNavigator<MainStackParamList>()

/**
 * Switches between the Auth and Main stacks based on AuthContext's status —
 * the RN equivalent of the web app's RequireAuth route guard, since there's
 * no URL to redirect: unmounting the Auth stack once authenticated is the
 * whole guard.
 */
export function RootNavigator() {
  const { status } = useAuth()

  if (status === 'loading') {
    return <LoadingScreen />
  }

  if (status === 'unauthenticated') {
    return (
      <AuthStack.Navigator screenOptions={{ headerShown: false }}>
        <AuthStack.Screen name="Login" component={LoginScreen} />
        <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      </AuthStack.Navigator>
    )
  }

  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      <MainStack.Screen name="Dashboard" component={DashboardScreen} />
    </MainStack.Navigator>
  )
}
