import { plantLabel, validatePlantingPhotoInput, type Bed, type Plant, type Planting, type PlantingPhoto } from '@plant-app/domain'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useEffect, useState } from 'react'
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { pickPhoto, type PhotoSource } from '../lib/pickPhoto'
import type { MainStackParamList } from '../navigation/types'
import { usePlantsRepository } from '../plants/PlantsRepositoryContext'
import { useBedsRepository } from '../property/BedsRepositoryContext'
import { usePropertiesRepository } from '../property/PropertiesRepositoryContext'
import { usePlantingsRepository } from './PlantingsRepositoryContext'

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Phone parity for viewing a Planting record and managing its dated photo
 * log (ticket #18) — the native counterpart of web's `PlantingMap` details
 * panel. Quantity/year acquired/source nursery are view-only here, matching
 * web exactly: web itself has no way to edit those fields after a Planting
 * is created (only the photo log and the Planting's removal are ever
 * mutated post-creation) — see `PlantingMap.tsx`. The Map screen (#14)
 * drops a Pin when a Planting is created; neither surface re-drops one
 * afterwards.
 */
export function PlantingDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const route = useRoute<RouteProp<MainStackParamList, 'PlantingDetail'>>()
  const { plantingId } = route.params
  const plantingsRepository = usePlantingsRepository()
  const plantsRepository = usePlantsRepository()
  const propertiesRepository = usePropertiesRepository()
  const bedsRepository = useBedsRepository()

  const [planting, setPlanting] = useState<Planting | null | undefined>(undefined)
  const [plant, setPlant] = useState<Plant | null>(null)
  const [beds, setBeds] = useState<Bed[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const [photos, setPhotos] = useState<PlantingPhoto[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string>>({})
  const [newPhotoDate, setNewPhotoDate] = useState(todayIsoDate())
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    let cancelled = false
    plantingsRepository
      .get(plantingId)
      .then((result) => {
        if (!cancelled) setPlanting(result)
      })
      .catch(() => {
        if (!cancelled) {
          setPlanting(null)
          setLoadError('Could not load this Planting.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [plantingId, plantingsRepository])

  useEffect(() => {
    if (!planting) return
    let cancelled = false
    plantsRepository
      .get(planting.plantId)
      .then((result) => {
        if (!cancelled) setPlant(result)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load this Planting’s Plant.')
      })
    return () => {
      cancelled = true
    }
  }, [planting, plantsRepository])

  useEffect(() => {
    let cancelled = false
    propertiesRepository
      .get()
      .then((property) => {
        if (cancelled || !property) return undefined
        return bedsRepository.list(property.id).then((result) => {
          if (!cancelled) setBeds(result)
        })
      })
      .catch(() => {
        // The Bed name is a nice-to-have on top of the Planting's own fields.
      })
    return () => {
      cancelled = true
    }
  }, [propertiesRepository, bedsRepository])

  useEffect(() => {
    if (!planting) {
      setPhotos([])
      return
    }
    let cancelled = false
    plantingsRepository
      .listPhotos(planting.id)
      .then((result) => {
        if (!cancelled) setPhotos(result)
      })
      .catch(() => {
        if (!cancelled) setPhotoError('Could not load this Planting’s photo log.')
      })
    return () => {
      cancelled = true
    }
  }, [planting, plantingsRepository])

  useEffect(() => {
    let cancelled = false
    Promise.allSettled(
      photos.map(async (photo) => [photo.path, await plantingsRepository.getPhotoUrl(photo.path)] as const),
    ).then((results) => {
      if (cancelled) return
      // Thumbnails are a nice-to-have; one photo's signing failure shouldn't
      // blank out every other photo's already-successful thumbnail.
      const entries = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
      setPhotoPreviews(Object.fromEntries(entries))
    })
    return () => {
      cancelled = true
    }
  }, [photos, plantingsRepository])

  async function handleAddPhoto(source: PhotoSource) {
    if (!planting) return
    const photoInput = { plantingId: planting.id, path: 'pending', takenOn: newPhotoDate }
    const validation = validatePlantingPhotoInput(photoInput)
    if (!validation.ok) {
      setPhotoError(Object.values(validation.errors)[0] ?? 'Could not add this photo.')
      return
    }
    setPhotoError(null)
    try {
      const picked = await pickPhoto(source)
      if (!picked) return
      setPhotoBusy(true)
      try {
        const photo = await plantingsRepository.addPhoto(planting.id, picked, newPhotoDate)
        setPhotos((current) => [photo, ...current])
      } catch {
        setPhotoError('Could not upload this photo. Please try again.')
      } finally {
        setPhotoBusy(false)
      }
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Could not open the photo picker.')
    }
  }

  async function handleRemovePhoto(photo: PlantingPhoto) {
    setPhotoBusy(true)
    setPhotoError(null)
    try {
      await plantingsRepository.removePhoto(photo.id, photo.path)
      setPhotos((current) => current.filter((p) => p.id !== photo.id))
    } catch {
      setPhotoError('Could not remove this photo. Please try again.')
    } finally {
      setPhotoBusy(false)
    }
  }

  function handleRemovePlanting() {
    if (!planting) return
    Alert.alert('Remove this Planting?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemoving(true)
          try {
            await plantingsRepository.remove(planting.id)
            navigation.goBack()
          } catch {
            setLoadError('Could not remove this Planting. Please try again.')
            setRemoving(false)
          }
        },
      },
    ])
  }

  const bed = planting ? beds.find((b) => b.id === planting.bedId) : undefined

  if (planting === undefined) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Text style={styles.loading}>Loading…</Text>
      </SafeAreaView>
    )
  }

  if (planting === null) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.container}>
          {loadError && <Text style={styles.error}>{loadError}</Text>}
          <Text>This Planting could not be found.</Text>
          <Pressable accessibilityRole="button" onPress={() => navigation.goBack()}>
            <Text style={styles.backLink}>Back to Registry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{plantLabel(plant ?? undefined)}</Text>
          <Pressable accessibilityRole="button" onPress={() => navigation.goBack()}>
            <Text style={styles.backLink}>Back to Registry</Text>
          </Pressable>
        </View>
        {loadError && <Text style={styles.error}>{loadError}</Text>}

        <View style={styles.details}>
          <Text>Quantity: {planting.quantity}</Text>
          {planting.yearAcquired && <Text>Year acquired: {planting.yearAcquired}</Text>}
          {planting.sourceNursery && <Text>Source: {planting.sourceNursery}</Text>}
          <Text>In {bed?.name ?? 'Bed'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photo log</Text>
          {photoError && <Text style={styles.error}>{photoError}</Text>}
          {photos.length === 0 && <Text>No photos yet.</Text>}
          <View style={styles.photoList}>
            {photos.map((photo) => (
              <View key={photo.id} style={styles.photoItem}>
                {photoPreviews[photo.path] && (
                  <Image source={{ uri: photoPreviews[photo.path] }} style={styles.photoThumbnail} />
                )}
                <Text style={styles.photoDate}>{photo.takenOn}</Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={photoBusy}
                  onPress={() => handleRemovePhoto(photo)}
                >
                  <Text style={styles.removeLink}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Photo date (YYYY-MM-DD)</Text>
            <TextInput
              accessibilityLabel="Photo date"
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={newPhotoDate}
              onChangeText={setNewPhotoDate}
            />
          </View>
          <View style={styles.photoActions}>
            <Pressable
              accessibilityRole="button"
              style={styles.buttonSecondary}
              disabled={photoBusy}
              onPress={() => handleAddPhoto('camera')}
            >
              <Text>Take photo</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.buttonSecondary}
              disabled={photoBusy}
              onPress={() => handleAddPhoto('library')}
            >
              <Text>Choose from library</Text>
            </Pressable>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          style={styles.deleteButton}
          disabled={removing}
          onPress={handleRemovePlanting}
        >
          <Text style={styles.deleteButtonText}>Remove Planting</Text>
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
  error: {
    color: '#b00020',
  },
  details: {
    gap: 4,
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
  photoDate: {
    flex: 1,
  },
  removeLink: {
    color: '#b00020',
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
