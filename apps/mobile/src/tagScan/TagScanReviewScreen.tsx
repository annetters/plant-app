import {
  checkForDuplicatePlant,
  validatePlantInput,
  type Plant,
  type PlantInput,
  type PlantValidationErrors,
  type UsdaSpeciesSuggestedTraits,
} from '@plant-app/domain'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { KeyboardAwareScrollView } from '../components/KeyboardAwareScrollView'
import type { MainStackParamList, TagScanPhotoIds } from '../navigation/types'
import { useSpeciesLookupRepository } from '../species/SpeciesLookupRepositoryContext'
import { SuggestedTraitsConfirmation } from '../species/SuggestedTraitsConfirmation'
import {
  MINIMUM_COMMON_NAME_LOOKUP_LENGTH,
  applySuggestedTraits,
  canLookUpCommonName,
  lookupSpeciesByCommonName,
  suggestSpeciesTraits,
} from '../species/speciesLookup'
import { useTagScanRepository } from './TagScanRepositoryContext'

function tagPhotoIdList(photoIds: TagScanPhotoIds): string[] {
  return [photoIds.frontTagPhotoId, ...(photoIds.backTagPhotoId ? [photoIds.backTagPhotoId] : [])]
}

/**
 * Nothing here is ever auto-applied — every field starts from whatever the
 * OCR/manual-entry adapter proposed (possibly nothing at all) and the user
 * must explicitly continue past this screen for any of it to be written.
 * See CONTEXT.md's Tag Scan rule and packages/domain/src/tagScanCandidate.ts.
 */
export function TagScanReviewScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const route = useRoute<RouteProp<MainStackParamList, 'TagScanReview'>>()
  const { scanId, photoIds, candidate } = route.params
  const repository = useTagScanRepository()
  const speciesLookup = useSpeciesLookupRepository()

  const [commonName, setCommonName] = useState(candidate?.commonName ?? '')
  const [scientificName, setScientificName] = useState(candidate?.scientificName ?? '')
  const [cultivar, setCultivar] = useState(candidate?.cultivar ?? '')
  const [errors, setErrors] = useState<PlantValidationErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [existingPlants, setExistingPlants] = useState<Plant[]>([])
  const [plantsLoaded, setPlantsLoaded] = useState(false)

  const [pendingCreation, setPendingCreation] = useState<{
    input: PlantInput
    traits: UsdaSpeciesSuggestedTraits
  } | null>(null)

  // Re-syncs fields when the user returns from picking an ambiguous species
  // (TagScanAmbiguousSpeciesScreen navigates back to this exact screen
  // instance — React Navigation reuses it rather than pushing a new one, so
  // without this effect the resolved scientific name would never appear).
  // Only fires on an actual candidate change, so it never clobbers a field
  // the user is still editing themselves.
  useEffect(() => {
    if (!candidate) return
    setCommonName(candidate.commonName ?? '')
    setScientificName(candidate.scientificName ?? '')
    setCultivar(candidate.cultivar ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate?.commonName, candidate?.scientificName, candidate?.cultivar])

  useEffect(() => {
    let cancelled = false
    repository
      .listPlants()
      .then((plants) => {
        if (cancelled) return
        setExistingPlants(plants)
        setPlantsLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setPlantsLoaded(true) // degrades to "no known duplicates" rather than blocking the scan forever
      })
    return () => {
      cancelled = true
    }
  }, [repository])

  async function handleLookupSpecies() {
    if (!canLookUpCommonName(commonName)) return
    setFormError(null)
    setBusy(true)
    try {
      const resolution = await lookupSpeciesByCommonName(speciesLookup, commonName)
      if (resolution.status === 'ambiguous') {
        navigation.navigate('TagScanAmbiguousSpecies', {
          scanId,
          photoIds,
          candidate: { commonName, scientificName, cultivar: cultivar || undefined },
          species: resolution.candidates,
        })
        return
      }
      if (resolution.status === 'resolved') {
        setScientificName(resolution.species.scientificName)
      } else {
        setFormError(
          'No USDA match for that common name — check the physical tag and enter the scientific name yourself.',
        )
      }
    } catch {
      setFormError('Could not look up that name. Check the physical tag and enter the scientific name yourself.')
    } finally {
      setBusy(false)
    }
  }

  /**
   * Plant creation and tag-photo linking are two separate writes. If linking
   * fails after the Plant was already created, that failure is swallowed
   * rather than reported as "could not save" — the Plant genuinely was
   * saved, and re-showing this screen with Continue re-enabled would let the
   * user resubmit and create a second, duplicate Plant from the same scan
   * (defeating the very check `checkForDuplicatePlant` just ran). Losing a
   * tag-photo link is a much smaller problem than a duplicate Plant record.
   */
  async function createPlant(input: PlantInput, traits?: UsdaSpeciesSuggestedTraits) {
    setBusy(true)
    setFormError(null)
    let plant: Plant
    try {
      plant = await repository.createPlant(applySuggestedTraits(input, traits))
    } catch {
      setFormError('Could not save this Plant. Please try again.')
      setBusy(false)
      return
    }
    await Promise.all(
      tagPhotoIdList(photoIds).map((id) => repository.linkTagPhotoToPlant(id, plant.id).catch(() => {})),
    )
    navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] })
  }

  async function handleContinue() {
    const input: PlantInput = {
      commonName: commonName.trim(),
      scientificName: scientificName.trim(),
      ...(cultivar.trim() && { cultivar: cultivar.trim() }),
    }
    const result = validatePlantInput(input)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    setFormError(null)

    const duplicateCheck = checkForDuplicatePlant(
      { scientificName: input.scientificName, cultivar: input.cultivar },
      existingPlants,
    )
    if (duplicateCheck.status === 'duplicate') {
      navigation.navigate('TagScanDuplicateOffer', {
        scanId,
        photoIds,
        candidate: { commonName: input.commonName, scientificName: input.scientificName, cultivar: input.cultivar },
        existingPlant: duplicateCheck.existingPlant,
      })
      return
    }

    setBusy(true)
    try {
      const traits = await suggestSpeciesTraits(speciesLookup, input.scientificName)
      if (Object.keys(traits).length === 0) {
        await createPlant(input)
        return
      }
      setPendingCreation({ input, traits })
    } catch {
      // A USDA lookup failure shouldn't block creating the Plant itself — it only forfeits the trait suggestion.
      await createPlant(input)
    } finally {
      setBusy(false)
    }
  }

  function cancelScan() {
    navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] })
  }

  if (pendingCreation) {
    const { input, traits } = pendingCreation
    return (
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAwareScrollView contentContainerStyle={styles.container}>
          <Pressable accessibilityRole="button" disabled={busy} onPress={cancelScan}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          {formError && <Text style={styles.error}>{formError}</Text>}
          <SuggestedTraitsConfirmation
            traits={traits}
            busy={busy}
            onAccept={() => createPlant(input, traits)}
            onSkip={() => createPlant(input)}
          />
        </KeyboardAwareScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAwareScrollView contentContainerStyle={styles.container}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={cancelScan}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Review tag scan</Text>
        <Text>Nothing is saved until you confirm — check these against the physical tag.</Text>

        <Text>Common name</Text>
        <TextInput
          accessibilityLabel="Common name"
          style={styles.input}
          value={commonName}
          onChangeText={setCommonName}
        />
        {errors.commonName && <Text style={styles.error}>{errors.commonName}</Text>}

        <Pressable
          accessibilityRole="button"
          disabled={busy || !canLookUpCommonName(commonName)}
          style={[
            styles.buttonSecondary,
            (busy || !canLookUpCommonName(commonName)) && styles.buttonSecondaryDisabled,
          ]}
          onPress={handleLookupSpecies}
        >
          <Text>Look up species</Text>
        </Pressable>
        {commonName.trim().length > 0 && !canLookUpCommonName(commonName) && (
          <Text style={styles.hint}>
            Type at least {MINIMUM_COMMON_NAME_LOOKUP_LENGTH} characters to look up a species.
          </Text>
        )}

        <Text>Scientific name</Text>
        <TextInput
          accessibilityLabel="Scientific name"
          style={styles.input}
          value={scientificName}
          onChangeText={setScientificName}
        />
        {errors.scientificName && <Text style={styles.error}>{errors.scientificName}</Text>}

        <Text>Cultivar</Text>
        <TextInput
          accessibilityLabel="Cultivar"
          style={styles.input}
          value={cultivar}
          onChangeText={setCultivar}
        />

        {formError && <Text style={styles.error}>{formError}</Text>}
        {!plantsLoaded && <Text>Checking your existing Plants for a match…</Text>}

        <Pressable
          accessibilityRole="button"
          disabled={busy || !plantsLoaded}
          style={styles.button}
          onPress={handleContinue}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </Pressable>
      </KeyboardAwareScrollView>
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
    marginBottom: 8,
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
  cancelText: {
    color: '#2e7d32',
    marginBottom: 8,
  },
  hint: {
    color: '#555',
  },
  buttonSecondaryDisabled: {
    borderColor: '#ccc',
    opacity: 0.5,
  },
})
