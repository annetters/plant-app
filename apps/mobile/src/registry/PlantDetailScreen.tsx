import {
  EMPTY_PLANT_FORM_FIELDS,
  FOLIAGE_TYPES,
  HARDINESS_ZONE_NUMBERS,
  NATIVE_STATUSES,
  SUN_REQUIREMENTS,
  formatOption,
  plantFormFieldsFromPlant,
  plantInputFromFormFields,
  validatePlantInput,
  type PlantFormFields,
  type PlantInput,
  type PlantValidationErrors,
  type SpeciesNameSummary,
  type UsdaSpeciesSuggestedTraits,
} from '@plant-app/domain'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useEffect, useRef, useState } from 'react'
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { KeyboardAwareScrollView } from '../components/KeyboardAwareScrollView'
import { ChipRow } from '../components/ChipRow'
import { pickPhoto, type PhotoSource } from '../lib/pickPhoto'
import type { MainStackParamList } from '../navigation/types'
import { usePlantsRepository } from '../plants/PlantsRepositoryContext'
import { useSpeciesLookupRepository } from '../species/SpeciesLookupRepositoryContext'
import { SuggestedTraitsConfirmation } from '../species/SuggestedTraitsConfirmation'
import {
  applySuggestedTraits,
  hasApplicableTraits,
  lookupSpeciesByCommonName,
  suggestSpeciesTraits,
  traitsNotAlreadySetBy,
} from '../species/speciesLookup'

const HARDINESS_ZONE_OPTIONS = HARDINESS_ZONE_NUMBERS.map(String)

/**
 * Phone parity for creating, viewing and editing a Plant record and its
 * reference photos — the native counterpart of web's `PlantFormPage`, trimmed
 * to the editing surface #18 asked for: no Care task template management here
 * (that stays web-only; see #12/#18's own scoping).
 *
 * One screen serves both create and edit, exactly as web mounts one
 * `PlantFormPage` at `/registry/new` and `/registry/:plantId`. Arriving
 * without a `plantId` (#31) starts from an empty form and creates on save;
 * from that first save on, this is an ordinary Plant detail screen, on the
 * same route. Keeping it one component is the point: a second copy of this
 * form is exactly the kind of thing that drifts (see the `plantLabel`
 * divergence #18's QA turned up between web and mobile).
 *
 * Tag Scan (#19/#20) remains the other creation path, for a plant that does
 * have a nursery tag to photograph.
 */
export function PlantDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const route = useRoute<RouteProp<MainStackParamList, 'PlantDetail'>>()
  const routePlantId = route.params?.plantId ?? null
  const repository = usePlantsRepository()
  const speciesLookup = useSpeciesLookupRepository()

  // Not derived from the route: a successful create swaps this screen from
  // create mode to edit mode in place, without a second navigation.
  const [plantId, setPlantId] = useState<string | null>(routePlantId)
  const [fields, setFields] = useState<PlantFormFields>(EMPTY_PLANT_FORM_FIELDS)
  const [referencePhotoPaths, setReferencePhotoPaths] = useState<string[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(routePlantId !== null)
  const [errors, setErrors] = useState<PlantValidationErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [photoBusy, setPhotoBusy] = useState<'camera' | 'library' | 'remove' | null>(null)
  const [lookingUpSpecies, setLookingUpSpecies] = useState(false)
  const [speciesCandidates, setSpeciesCandidates] = useState<SpeciesNameSummary[] | null>(null)
  const [pendingCreation, setPendingCreation] = useState<{
    input: PlantInput
    traits: UsdaSpeciesSuggestedTraits
  } | null>(null)
  const scrollViewRef = useRef<ScrollView>(null)

  useEffect(() => {
    if (!routePlantId) return
    let cancelled = false
    repository
      .get(routePlantId)
      .then((plant) => {
        if (cancelled) return
        if (!plant) {
          setFormError('Plant not found.')
          setLoading(false)
          return
        }
        setFields(plantFormFieldsFromPlant(plant))
        setReferencePhotoPaths(plant.referencePhotoPaths)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setFormError('Could not load this Plant.')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [routePlantId, repository])

  useEffect(() => {
    let cancelled = false
    Promise.all(
      referencePhotoPaths.map(
        async (path) => [path, await repository.getReferencePhotoUrl(path)] as const,
      ),
    )
      .then((entries) => {
        if (!cancelled) setPhotoPreviews(Object.fromEntries(entries))
      })
      .catch(() => {
        // Thumbnails are a nice-to-have; a signing failure shouldn't block the rest of the screen.
      })
    return () => {
      cancelled = true
    }
  }, [referencePhotoPaths, repository])

  function updateField<K extends keyof PlantFormFields>(key: K, value: PlantFormFields[K]) {
    setFields((current) => ({ ...current, [key]: value }))
    setStatusMessage(null)
  }

  function validatedInputFor(nextPaths: string[]): PlantInput | null {
    const input = plantInputFromFormFields(fields, nextPaths)
    const result = validatePlantInput(input)
    if (!result.ok) {
      setErrors(result.errors)
      return null
    }
    setErrors({})
    return input
  }

  async function handleSave() {
    const input = validatedInputFor(referencePhotoPaths)
    if (!input) {
      // The failing field's own inline error could be scrolled out of view
      // (e.g. a blank required "Common name" at the top while the user is
      // down by the Save button) — scroll back up so it's actually visible,
      // and say so here too in case some of it still isn't.
      setFormError('Fix the highlighted fields above.')
      scrollViewRef.current?.scrollTo({ y: 0, animated: true })
      return
    }
    setFormError(null)
    setStatusMessage(null)
    if (!plantId) {
      await offerTraitsThenCreate(input)
      return
    }
    setSubmitting(true)
    try {
      await repository.update(plantId, input)
      setStatusMessage('Saved.')
    } catch {
      setFormError('Could not save this Plant. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * Same shape as Tag Scan's review screen: ask USDA what it knows about the
   * scientific name and, if it knows anything, show it for confirmation
   * before writing. Nothing is ever auto-applied (CONTEXT.md's Tag Scan
   * rule), and a lookup failure forfeits only the suggestion, never the save.
   */
  async function offerTraitsThenCreate(input: PlantInput) {
    setSubmitting(true)
    let traits: UsdaSpeciesSuggestedTraits = {}
    try {
      // Only what the user hasn't answered themselves: this form, unlike Tag
      // Scan's review screen, has its own Sun/shade and Mature height inputs,
      // and a suggestion must never overwrite a value they typed.
      traits = traitsNotAlreadySetBy(
        await suggestSpeciesTraits(speciesLookup, input.scientificName),
        input,
      )
    } catch {
      // No suggestion available — fall through and create the Plant as typed.
    } finally {
      setSubmitting(false)
    }
    // Unlike Tag Scan, don't interrupt the save for a panel that could only
    // report the reference-only hardiness zone and change nothing.
    if (hasApplicableTraits(traits)) {
      setPendingCreation({ input, traits })
      return
    }
    await handleCreate(input)
  }

  async function handleCreate(input: PlantInput, traits?: UsdaSpeciesSuggestedTraits) {
    setPendingCreation(null)
    setSubmitting(true)
    try {
      const created = await repository.create(applySuggestedTraits(input, traits))
      // Re-deriving the form from the created row is what turns this into an
      // ordinary detail screen: any trait just applied becomes visible, and
      // Delete/photo actions unlock because `plantId` is now set.
      setPlantId(created.id)
      setFields(plantFormFieldsFromPlant(created))
      setReferencePhotoPaths(created.referencePhotoPaths)
      setSpeciesCandidates(null)
      setStatusMessage('Saved.')
    } catch {
      setFormError('Could not save this Plant. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  /** The same species lookup Tag Scan's review screen offers — see `speciesLookup.ts`; the two share one mechanism rather than two copies. */
  async function handleLookupSpecies() {
    if (!fields.commonName.trim()) return
    setFormError(null)
    setSpeciesCandidates(null)
    setLookingUpSpecies(true)
    try {
      const resolution = await lookupSpeciesByCommonName(speciesLookup, fields.commonName)
      if (resolution.status === 'ambiguous') {
        // A common name can span several species (CONTEXT.md's Liatris
        // example) — never guess. Tag Scan pushes its own screen for this;
        // here the candidates list inline, since there's no scan to return to.
        setSpeciesCandidates(resolution.candidates)
      } else if (resolution.status === 'resolved') {
        updateField('scientificName', resolution.species.scientificName)
        setStatusMessage(`Scientific name set from USDA PLANTS: ${resolution.species.scientificName}`)
      } else {
        setFormError(
          'No USDA match for that common name — enter the scientific name yourself.',
        )
      }
    } catch {
      setFormError('Could not look up that name. Enter the scientific name yourself.')
    } finally {
      setLookingUpSpecies(false)
    }
  }

  function handleSelectSpecies(species: SpeciesNameSummary) {
    updateField('scientificName', species.scientificName)
    setSpeciesCandidates(null)
    setStatusMessage(`Scientific name set from USDA PLANTS: ${species.scientificName}`)
  }

  async function handleAddPhoto(source: PhotoSource) {
    if (!plantId) return
    setFormError(null)
    setStatusMessage(null)
    try {
      const picked = await pickPhoto(source)
      if (!picked) return
      setPhotoBusy(source)
      let uploadedPath: string | null = null
      try {
        uploadedPath = await repository.uploadReferencePhoto(plantId, picked)
        const nextPaths = [...referencePhotoPaths, uploadedPath]
        const input = validatedInputFor(nextPaths)
        if (!input) {
          setFormError('Fix the highlighted fields above, then add a photo again.')
          throw new Error('Plant fields are invalid.')
        }
        await repository.update(plantId, input)
        setReferencePhotoPaths(nextPaths)
        setStatusMessage('Photo added.')
      } catch {
        if (uploadedPath) {
          await repository.removeReferencePhoto(uploadedPath).catch(() => {})
        }
        setFormError((current) => current ?? 'Could not upload this photo. Please try again.')
      } finally {
        setPhotoBusy(null)
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not open the photo picker.')
    }
  }

  async function handleRemovePhoto(path: string) {
    if (!plantId) return
    const nextPaths = referencePhotoPaths.filter((existing) => existing !== path)
    const input = validatedInputFor(nextPaths)
    if (!input) {
      setFormError('Fix the highlighted fields above, then remove photos again.')
      return
    }
    setPhotoBusy('remove')
    setFormError(null)
    setStatusMessage(null)
    try {
      await repository.removeReferencePhoto(path)
      await repository.update(plantId, input)
      setReferencePhotoPaths(nextPaths)
      setStatusMessage('Photo removed.')
    } catch {
      setFormError('Could not remove this photo. Please try again.')
    } finally {
      setPhotoBusy(null)
    }
  }

  function handleDelete() {
    if (!plantId) return
    Alert.alert('Delete this Plant?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSubmitting(true)
          try {
            await repository.remove(plantId)
            navigation.goBack()
          } catch {
            setFormError('Could not delete this Plant. Please try again.')
            setSubmitting(false)
          }
        },
      },
    ])
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Text style={styles.loading}>Loading…</Text>
      </SafeAreaView>
    )
  }

  if (pendingCreation) {
    const { input, traits } = pendingCreation
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAwareScrollView contentContainerStyle={styles.container}>
          {formError && <Text style={styles.error}>{formError}</Text>}
          <SuggestedTraitsConfirmation
            traits={traits}
            busy={submitting}
            onAccept={() => handleCreate(input, traits)}
            onSkip={() => handleCreate(input)}
            footer={
              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => setPendingCreation(null)}
              >
                <Text style={styles.backLink}>Back to the form</Text>
              </Pressable>
            }
          />
        </KeyboardAwareScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAwareScrollView ref={scrollViewRef} contentContainerStyle={styles.container}>
        <View style={styles.header}>
          {/* Titled as a header so it's distinguishable from the identically
              labelled submit button — to a screen reader as well as a test. */}
          <Text accessibilityRole="header" style={styles.title}>
            {plantId ? fields.commonName || 'Plant' : 'Add Plant'}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => navigation.goBack()}>
            <Text style={styles.backLink}>Back to Registry</Text>
          </Pressable>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Common name *</Text>
          <TextInput
            accessibilityLabel="Common name"
            style={styles.input}
            value={fields.commonName}
            onChangeText={(value) => updateField('commonName', value)}
          />
          {errors.commonName && <Text style={styles.error}>{errors.commonName}</Text>}
        </View>

        {/* Create only: on an existing Plant the scientific name is already
            settled, and #31 leaves the editing surface exactly as it was. */}
        {!plantId && (
          <View style={styles.field}>
            <Pressable
              accessibilityRole="button"
              style={[
                styles.buttonSecondary,
                (lookingUpSpecies || !fields.commonName.trim()) && styles.buttonSecondaryDisabled,
              ]}
              disabled={lookingUpSpecies || !fields.commonName.trim()}
              onPress={handleLookupSpecies}
            >
              <Text>{lookingUpSpecies ? 'Looking up…' : 'Look up species'}</Text>
            </Pressable>
            {speciesCandidates && (
              <View accessibilityLabel="Species candidates" style={styles.candidateList}>
                <Text>
                  "{fields.commonName}" matches more than one species. Pick the one you mean — if
                  none are right, type the scientific name yourself.
                </Text>
                {speciesCandidates.map((species) => (
                  <Pressable
                    key={species.scientificName}
                    accessibilityRole="button"
                    style={styles.candidate}
                    onPress={() => handleSelectSpecies(species)}
                  >
                    <Text style={styles.candidateScientificName}>{species.scientificName}</Text>
                    <Text>{species.commonName}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Scientific name *</Text>
          <TextInput
            accessibilityLabel="Scientific name"
            style={styles.input}
            value={fields.scientificName}
            onChangeText={(value) => updateField('scientificName', value)}
          />
          {errors.scientificName && <Text style={styles.error}>{errors.scientificName}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Cultivar</Text>
          <TextInput
            accessibilityLabel="Cultivar"
            style={styles.input}
            value={fields.cultivar}
            onChangeText={(value) => updateField('cultivar', value)}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Flower color</Text>
          <TextInput
            accessibilityLabel="Flower color"
            style={styles.input}
            value={fields.flowerColor}
            onChangeText={(value) => updateField('flowerColor', value)}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Bloom window</Text>
          <View style={styles.datePairRow}>
            <TextInput
              accessibilityLabel="Bloom start month"
              placeholder="Start month"
              style={[styles.input, styles.dateInput]}
              keyboardType="number-pad"
              maxLength={2}
              value={fields.bloomStartMonth}
              onChangeText={(value) => updateField('bloomStartMonth', value)}
            />
            <TextInput
              accessibilityLabel="Bloom start day"
              placeholder="Start day"
              style={[styles.input, styles.dateInput]}
              keyboardType="number-pad"
              maxLength={2}
              value={fields.bloomStartDay}
              onChangeText={(value) => updateField('bloomStartDay', value)}
            />
          </View>
          <View style={styles.datePairRow}>
            <TextInput
              accessibilityLabel="Bloom end month"
              placeholder="End month"
              style={[styles.input, styles.dateInput]}
              keyboardType="number-pad"
              maxLength={2}
              value={fields.bloomEndMonth}
              onChangeText={(value) => updateField('bloomEndMonth', value)}
            />
            <TextInput
              accessibilityLabel="Bloom end day"
              placeholder="End day"
              style={[styles.input, styles.dateInput]}
              keyboardType="number-pad"
              maxLength={2}
              value={fields.bloomEndDay}
              onChangeText={(value) => updateField('bloomEndDay', value)}
            />
          </View>
          {(errors['bloomWindow.start'] || errors['bloomWindow.end']) && (
            <Text style={styles.error}>{errors['bloomWindow.start'] ?? errors['bloomWindow.end']}</Text>
          )}
        </View>

        <ChipRow
          label="Sun/shade requirement"
          options={SUN_REQUIREMENTS}
          selected={fields.sunRequirement}
          onSelect={(value) => updateField('sunRequirement', value as PlantFormFields['sunRequirement'])}
          formatChip={formatOption}
        />

        <View style={styles.field}>
          <Text style={styles.label}>Mature height (inches)</Text>
          <TextInput
            accessibilityLabel="Mature height"
            style={styles.input}
            keyboardType="number-pad"
            value={fields.matureHeightInches}
            onChangeText={(value) => updateField('matureHeightInches', value)}
          />
          {errors.matureHeightInches && <Text style={styles.error}>{errors.matureHeightInches}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Mature spread (inches)</Text>
          <TextInput
            accessibilityLabel="Mature spread"
            style={styles.input}
            keyboardType="number-pad"
            value={fields.matureSpreadInches}
            onChangeText={(value) => updateField('matureSpreadInches', value)}
          />
          {errors.matureSpreadInches && <Text style={styles.error}>{errors.matureSpreadInches}</Text>}
        </View>

        <ChipRow
          label="USDA hardiness zone (min)"
          options={HARDINESS_ZONE_OPTIONS}
          selected={fields.hardinessZoneMin}
          onSelect={(value) => updateField('hardinessZoneMin', value)}
          formatChip={(value) => value}
        />
        <ChipRow
          label="USDA hardiness zone (max)"
          options={HARDINESS_ZONE_OPTIONS}
          selected={fields.hardinessZoneMax}
          onSelect={(value) => updateField('hardinessZoneMax', value)}
          formatChip={(value) => value}
        />
        {(errors['hardinessZoneRange.min'] || errors['hardinessZoneRange.max']) && (
          <Text style={styles.error}>
            {errors['hardinessZoneRange.min'] ?? errors['hardinessZoneRange.max']}
          </Text>
        )}

        <ChipRow
          label="Foliage"
          options={FOLIAGE_TYPES}
          selected={fields.foliageType}
          onSelect={(value) => updateField('foliageType', value as PlantFormFields['foliageType'])}
          formatChip={formatOption}
        />

        <ChipRow
          label="Native status"
          options={NATIVE_STATUSES}
          selected={fields.nativeStatus}
          onSelect={(value) => updateField('nativeStatus', value as PlantFormFields['nativeStatus'])}
          formatChip={formatOption}
        />

        {/* Both of these need a Plant row to act on — a photo needs somewhere
            to be uploaded against, and there is nothing yet to delete. They
            appear the moment the first save creates one. */}
        {plantId && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reference photos</Text>
            {referencePhotoPaths.length === 0 && <Text>No reference photos yet.</Text>}
            <View style={styles.photoList}>
              {referencePhotoPaths.map((path) => (
                <View key={path} style={styles.photoItem}>
                  {photoPreviews[path] && (
                    <Image source={{ uri: photoPreviews[path] }} style={styles.photoThumbnail} />
                  )}
                  <Pressable
                    accessibilityRole="button"
                    disabled={photoBusy !== null}
                    onPress={() => handleRemovePhoto(path)}
                  >
                    <Text style={styles.removeLink}>{photoBusy === 'remove' ? 'Removing…' : 'Remove'}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
            <View style={styles.photoActions}>
              <Pressable
                accessibilityRole="button"
                style={styles.buttonSecondary}
                disabled={photoBusy !== null}
                onPress={() => handleAddPhoto('camera')}
              >
                <Text>{photoBusy === 'camera' ? 'Uploading…' : 'Take photo'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={styles.buttonSecondary}
                disabled={photoBusy !== null}
                onPress={() => handleAddPhoto('library')}
              >
                <Text>{photoBusy === 'library' ? 'Uploading…' : 'Choose from library'}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {formError && <Text style={styles.error}>{formError}</Text>}
        {statusMessage && <Text style={styles.status}>{statusMessage}</Text>}

        <Pressable
          accessibilityRole="button"
          style={styles.saveButton}
          disabled={submitting}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>
            {submitting ? 'Saving…' : plantId ? 'Save changes' : 'Add Plant'}
          </Text>
        </Pressable>

        {plantId && (
          <Pressable
            accessibilityRole="button"
            style={styles.deleteButton}
            disabled={submitting}
            onPress={handleDelete}
          >
            <Text style={styles.deleteButtonText}>Delete Plant</Text>
          </Pressable>
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loading: {
    padding: 24,
  },
  container: {
    flexGrow: 1,
    padding: 24,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    flexShrink: 1,
  },
  backLink: {
    color: '#2e7d32',
  },
  field: {
    gap: 4,
  },
  label: {
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
  },
  datePairRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateInput: {
    flex: 1,
  },
  error: {
    color: '#b00020',
  },
  status: {
    color: '#2e7d32',
  },
  saveButton: {
    backgroundColor: '#2e7d32',
    borderRadius: 4,
    padding: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
  },
  section: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  photoList: {
    gap: 12,
  },
  photoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  photoThumbnail: {
    width: 72,
    height: 72,
    borderRadius: 4,
  },
  removeLink: {
    color: '#b00020',
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: '#2e7d32',
    borderRadius: 4,
    padding: 12,
    alignItems: 'center',
    flex: 1,
  },
  buttonSecondaryDisabled: {
    opacity: 0.5,
  },
  candidateList: {
    gap: 8,
    marginTop: 8,
  },
  candidate: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 12,
  },
  candidateScientificName: {
    fontStyle: 'italic',
    fontWeight: '600',
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: '#b00020',
    borderRadius: 4,
    padding: 12,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#b00020',
  },
})
