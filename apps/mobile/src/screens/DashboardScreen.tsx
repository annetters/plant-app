import { DASHBOARD_TILES } from '@plant-app/domain'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useAuth } from '../auth/AuthContext'

export function DashboardScreen() {
  const { logOut } = useAuth()

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <Pressable accessibilityRole="button" onPress={() => logOut()}>
          <Text>Log out</Text>
        </Pressable>
      </View>
      <View style={styles.tiles}>
        {DASHBOARD_TILES.map((tile) => (
          <View key={tile.id} style={styles.tile}>
            <Text>{tile.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  tiles: {
    gap: 8,
  },
  tile: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 16,
  },
})
