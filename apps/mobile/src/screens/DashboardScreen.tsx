import { DASHBOARD_TILES } from '@plant-app/domain'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../auth/AuthContext'
import type { MainStackParamList } from '../navigation/types'

/** Which native screen each shared Dashboard tile opens. Only routes taking no params belong here — the tile is a bare "go there" link. */
const TILE_ROUTES: Record<string, 'Map' | 'Registry' | 'BloomTimeline'> = {
  map: 'Map',
  registry: 'Registry',
  'bloom-timeline': 'BloomTimeline',
}

export function DashboardScreen() {
  const { user, logOut } = useAuth()
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <Pressable accessibilityRole="button" onPress={() => logOut()}>
          <Text>Log out</Text>
        </Pressable>
      </View>
      {user?.email && <Text style={styles.accountEmail}>Signed in as {user.email}</Text>}
      {/* Mobile-only entry point — Tag Scan's on-device OCR placement (ADR-0004)
          makes this a mobile feature, unlike DASHBOARD_TILES below, which is
          shared with a future web dashboard. */}
      <Pressable
        accessibilityRole="button"
        style={styles.scanButton}
        onPress={() => navigation.navigate('TagScanCapture')}
      >
        <Text style={styles.scanButtonText}>Scan a tag</Text>
      </Pressable>
      {/* A plain link, not a tile — matching web's TasksPage entry point and
          CONTEXT.md's Dashboard entry ("Task lists not surfaced immediately —
          reachable within 2–3 taps"). */}
      <Pressable
        accessibilityRole="button"
        style={styles.tasksLink}
        onPress={() => navigation.navigate('Tasks')}
      >
        <Text style={styles.tasksLinkText}>Tasks &amp; To-dos</Text>
      </Pressable>
      <View style={styles.tiles}>
        {DASHBOARD_TILES.map((tile) => {
          const route = TILE_ROUTES[tile.id]
          // A tile with nowhere native to go yet renders inert rather than
          // crashing on an unknown route — DASHBOARD_TILES is shared with
          // web, so it can grow a tile before this app has a screen for it.
          // That's exactly what the Map tile was until #14.
          if (!route) {
            return (
              <View key={tile.id} style={styles.tile}>
                <Text>{tile.label}</Text>
              </View>
            )
          }
          return (
            <Pressable
              key={tile.id}
              accessibilityRole="button"
              style={styles.tile}
              onPress={() => navigation.navigate(route)}
            >
              <Text>{tile.label}</Text>
            </Pressable>
          )
        })}
      </View>
    </SafeAreaView>
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
  accountEmail: {
    color: '#666',
    marginBottom: 16,
  },
  scanButton: {
    backgroundColor: '#2e7d32',
    borderRadius: 4,
    padding: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  scanButtonText: {
    color: '#fff',
  },
  tasksLink: {
    marginBottom: 24,
  },
  tasksLinkText: {
    color: '#2e7d32',
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
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
