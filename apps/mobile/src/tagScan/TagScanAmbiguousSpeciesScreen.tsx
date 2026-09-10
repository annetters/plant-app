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

  /**
   * Resolving the species sets the scientific name — that's what was being
   * asked. It does **not** rewrite the common name the gardener typed, which
   * is the same rule `traitsNotAlreadySetBy` follows: a value they entered is
   * their decision, and a lookup proposes rather than decides (CONTEXT.md).
   *
   * This used to overwrite it, and #36 is what exposed the problem rather than
   * causing it. Against the old 2,186-row dataset the two strings were usually
   * near-identical; against the full checklist, picking *Monarda fistulosa*
   * after typing "bee balm" replaced it with USDA's "wild bergamot" — both
   * correct, but only one of them is what the tag in their hand says.
   *
   * USDA's name is still taken when the field is empty, including the 5,218
   * accepted taxa USDA carries no common name for at all.
   */
  function handleSelect(scientificName: string, commonName: string | null) {
    navigation.navigate('TagScanReview', {
      scanId,
      photoIds,
      candidate: {
        ...candidate,
        scientificName,
        commonName: candidate.commonName?.trim() ? candidate.commonName : (commonName ?? undefined),
      },
    })
  }

  return (
    <SafeAreaView style={styles.container}>
      <Pressable accessibilityRole="button" onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>Go back and edit</Text>
      </Pressable>
      <Text style={styles.title}>Which one is this?</Text>
      <Text>
        "{candidate.commonName}" matches more than one species. Check the physical tag, then pick
        the one it names. If none of these are right, go back and adjust what you typed.
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
            <Text>{item.commonName ?? 'No USDA common name'}</Text>
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
  backText: {
    color: '#2e7d32',
  },
})
