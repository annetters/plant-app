import { StyleSheet, Text, View } from 'react-native'

export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <Text>Loading…</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
