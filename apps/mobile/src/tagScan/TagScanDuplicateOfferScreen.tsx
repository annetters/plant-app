import { validatePlantInput, type PlantInput } from '@plant-app/domain'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { MainStackParamList, TagScanPhotoIds } from '../navigation/types'
import { useTagScanRepository } from './TagScanRepositoryContext'

function tagPhotoIdList(photoIds: TagScanPhotoIds): string[] {
  return [photoIds.frontTagPhotoId, ...(photoIds.backTagPhotoId ? [photoIds.backTagPhotoId] : [])]
}

/**
 * Per CONTEXT.md: before creating a new Plant, offer a new Planting against
 * an existing matching one instead of a duplicate. Planting CRUD (issue #8)
 * doesn't exist yet, so this screen states that plainly rather than
 * silently no-op'ing — the duplicate *decision* (`checkForDuplicatePlant`)
 * is real; only the follow-on Planting-creation flow is a stub, tracked in
 * #8, not a design gap here.
 */
export function TagScanDuplicateOfferScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const route = useRoute<RouteProp<MainStackParamList, 'TagScanDuplicateOffer'>>()
  const { photoIds, candidate, existingPlant } = route.params
  const repository = useTagScanRepository()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreateAnyway() {
    const input: PlantInput = {
      commonName: (candidate.commonName ?? existingPlant.commonName).trim(),
      scientificName: (candidate.scientificName ?? existingPlant.scientificName).trim(),
      ...(candidate.cultivar?.trim() && { cultivar: candidate.cultivar.trim() }),
    }
    const result = validatePlantInput(input)
    if (!result.ok) {
      setError('Some of this scan\'s details are invalid — go back and fix them before creating anyway.')
      return
    }

    setBusy(true)
    setError(null)
    let plant
    try {
      plant = await repository.createPlant(input)
    } catch {
      setError('Could not save this Plant. Please try again.')
      setBusy(false)
      return
    }
    // Non-fatal if linking fails — the Plant itself was saved; see
    // TagScanReviewScreen.createPlant for why a link failure must not be
    // reported as a save failure (it would invite a resubmit that creates a
    // second duplicate Plant).
    await Promise.all(
      tagPhotoIdList(photoIds).map((id) => repository.linkTagPhotoToPlant(id, plant.id).catch(() => {})),
    )
    navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] })
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>You already have this Plant</Text>
        <Text style={styles.plantIdentity}>
          {existingPlant.commonName} ({existingPlant.scientificName}
          {existingPlant.cultivar ? ` '${existingPlant.cultivar}'` : ''})
        </Text>
        <Text>
          Tag Scan normally offers a new Planting against your existing record instead of a
          duplicate Plant — that part isn't built yet (tracked separately). For now, go back to
          adjust what you entered, or create a new Plant anyway if this is genuinely a different
          plant.
        </Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Go back and edit</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          style={styles.buttonSecondary}
          onPress={handleCreateAnyway}
        >
          <Text>This is actually different — create anyway</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: 24,
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  plantIdentity: {
    fontStyle: 'italic',
  },
  button: {
    backgroundColor: '#2e7d32',
    borderRadius: 4,
    padding: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: '#2e7d32',
    borderRadius: 4,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  error: {
    color: '#b00020',
  },
})
