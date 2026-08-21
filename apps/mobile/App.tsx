import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthContext';
import { useAuthDeepLinkHandler } from './src/auth/useAuthDeepLinkHandler';
import { supabase } from './src/lib/supabaseClient';
import { RootNavigator } from './src/navigation/RootNavigator';

function AppShell() {
  useAuthDeepLinkHandler(supabase);

  return (
    <NavigationContainer>
      <RootNavigator />
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider client={supabase}>
        <AppShell />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
