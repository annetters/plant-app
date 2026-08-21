import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { makeRedirectUri } from 'expo-auth-session'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useAuth } from '../auth/AuthContext'
import { useCredentialsForm } from '../auth/useCredentialsForm'
import type { AuthStackParamList } from '../navigation/types'

export function SignUpScreen() {
  const { signUp } = useAuth()
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>()
  const [submitted, setSubmitted] = useState(false)
  const form = useCredentialsForm(async (email, password) => {
    const result = await signUp(email, password, { emailRedirectTo: makeRedirectUri() })
    if (!result.error) {
      setSubmitted(true)
    }
    return result
  })

  if (submitted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Check your email</Text>
        <Text>We sent a confirmation link to {form.email}. Follow it to finish signing up.</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign up</Text>

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
        autoComplete="new-password"
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
        <Text>Sign up</Text>
      </Pressable>

      <Pressable onPress={() => navigation.navigate('Login')}>
        <Text>Already have an account? Log in</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
