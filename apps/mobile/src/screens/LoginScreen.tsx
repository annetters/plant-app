import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../auth/AuthContext'
import { useCredentialsForm } from '../auth/useCredentialsForm'
import type { AuthStackParamList } from '../navigation/types'

export function LoginScreen() {
  const { logIn } = useAuth()
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>()
  const form = useCredentialsForm(logIn)

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.safeArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Log in</Text>

          <Text>Email</Text>
          <TextInput
            accessibilityLabel="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            style={styles.input}
            value={form.email}
            onChangeText={form.setEmail}
          />

          <Text>Password</Text>
          <TextInput
            accessibilityLabel="Password"
            autoComplete="current-password"
            secureTextEntry
            style={styles.input}
            value={form.password}
            onChangeText={form.setPassword}
          />

          {form.error && <Text style={styles.error}>{form.error}</Text>}

          <Pressable
            accessibilityRole="button"
            disabled={form.submitting}
            style={styles.button}
            onPress={form.submit}
          >
            <Text>Log in</Text>
          </Pressable>

          <Pressable onPress={() => navigation.navigate('SignUp')}>
            <Text>Don't have an account? Sign up</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#2e7d32',
    borderRadius: 4,
    padding: 12,
    alignItems: 'center',
    marginVertical: 8,
  },
  error: {
    color: '#b00020',
  },
})
