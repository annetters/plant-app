import type { TagOcrCandidateFields } from '@plant-app/domain'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { FlatList, Pressable, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { MainStackParamList } from '../navigation/types'

/**
 * A single tag photo can yield more than one distinct scientific-name
 * reading — see ADR-0004's tag2 finding, where one photo combined the front
 * of one tag with the back of an unrelated one. Rather than silently taking
 * the first OCR candidate (which would reproduce exactly that failure mode
 * once a real OCR adapter is in play), this surfaces every distinct reading
 * and asks the user to pick which one actually names the tag they scanned —
 * same "show candidates, let the user confirm" rule as
 * TagScanAmbiguousSpeciesScreen, just one step earlier in the flow.
 */
export function TagScanMultipleReadingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const route = useRoute<RouteProp<MainStackParamList, 'TagScanMultipleReadings'>>()
  const { scanId, photoIds, candidates } = route.params

  function handleSelect(candidate: TagOcrCandidateFields) {
    navigation.navigate('TagScanReview', { scanId, photoIds, candidate })
  }

  function handleNoneOfThese() {
    navigation.navigate('TagScanReview', { scanId, photoIds })
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Which reading is this tag?</Text>
      <Text>
        This photo appears to show more than one plant name. Check the physical tag, then pick
        the one it actually names.
      </Text>
      <FlatList
        data={candidates}
        keyExtractor={(item, index) => `${item.scientificName ?? ''}-${item.cultivar ?? ''}-${index}`}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" style={styles.option} onPress={() => handleSelect(item)}>
            <Text style={styles.optionScientificName}>{item.scientificName}</Text>
            {item.cultivar && <Text>'{item.cultivar}'</Text>}
          </Pressable>
        )}
      />
      <Pressable accessibilityRole="button" style={styles.buttonSecondary} onPress={handleNoneOfThese}>
        <Text>None of these — enter manually</Text>
      </Pressable>
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
  buttonSecondary: {
    borderWidth: 1,
    borderColor: '#2e7d32',
    borderRadius: 4,
    padding: 12,
    alignItems: 'center',
    marginTop: 16,
  },
})
