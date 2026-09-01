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
} from '@plant-app/domain'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useEffect, useRef, useState } from 'react'
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChipRow } from '../components/ChipRow'
import { pickPhoto, type PhotoSource } from '../lib/pickPhoto'
import type { MainStackParamList } from '../navigation/types'
import { usePlantsRepository } from '../plants/PlantsRepositoryContext'

const HARDINESS_ZONE_OPTIONS = HARDINESS_ZONE_NUMBERS.map(String)

/**
 * Phone parity for viewing/editing a Plant record and its reference photos
 * (ticket #18) — the native counterpart of web's `PlantFormPage`, trimmed to
 * the editing surface #18 actually asks for: no Care task template
 * management here (that stays web-only; see #12/#18's own scoping), and no
 * "create" flow (Tag Scan is mobile's Plant-creation path — see #19/#20).
 */
export function PlantDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const route = useRoute<RouteProp<MainStackParamList, 'PlantDetail'>>()
  const { plantId } = route.params
  const repository = usePlantsRepository()

  const [fields, setFields] = useState<PlantFormFields>(EMPTY_PLANT_FORM_FIELDS)
  const [referencePhotoPaths, setReferencePhotoPaths] = useState<string[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<PlantValidationErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [photoBusy, setPhotoBusy] = useState<'camera' | 'library' | 'remove' | null>(null)
  const scrollViewRef = useRef<ScrollView>(null)

  useEffect(() => {
    let cancelled = false
    repository
      .get(plantId)
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
  }, [plantId, repository])

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

  async function handleAddPhoto(source: PhotoSource) {
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView ref={scrollViewRef} contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{fields.commonName || 'Plant'}</Text>
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

        {formError && <Text style={styles.error}>{formError}</Text>}
        {statusMessage && <Text style={styles.status}>{statusMessage}</Text>}

        <Pressable
          accessibilityRole="button"
          style={styles.saveButton}
          disabled={submitting}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>{submitting ? 'Saving…' : 'Save changes'}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={styles.deleteButton}
          disabled={submitting}
          onPress={handleDelete}
        >
          <Text style={styles.deleteButtonText}>Delete Plant</Text>
        </Pressable>
      </ScrollView>
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
