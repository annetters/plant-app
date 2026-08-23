import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { FlatList, Pressable, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { MainStackParamList } from '../navigation/types'

/**
 * A common name can span multiple species (CONTEXT.md's Liatris example) —
 * this never guesses which one the user means. It surfaces every distinct
 * species candidate and asks the user to check the physical tag, per
 * CONTEXT.md's Tag Scan rule.
 */
export function TagScanAmbiguousSpeciesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const route = useRoute<RouteProp<MainStackParamList, 'TagScanAmbiguousSpecies'>>()
  const { scanId, photoIds, candidate, species } = route.params

  function handleSelect(scientificName: string, commonName: string) {
    navigation.navigate('TagScanReview', {
      scanId,
      photoIds,
      candidate: { ...candidate, scientificName, commonName },
    })
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Which one is this?</Text>
      <Text>
        "{candidate.commonName}" matches more than one species. Check the physical tag, then pick
        the one it names.
      </Text>
      <FlatList
        data={species}
        keyExtractor={(item) => item.scientificName}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            style={styles.option}
            onPress={() => handleSelect(item.scientificName, item.commonName)}
          >
            <Text style={styles.optionScientificName}>{item.scientificName}</Text>
            <Text>{item.commonName}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  option: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 12,
    marginTop: 8,
  },
  optionScientificName: {
    fontStyle: 'italic',
    fontWeight: '600',
  },
})
