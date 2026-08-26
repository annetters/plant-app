import { reviewTagOcrCandidates } from '@plant-app/domain'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as Crypto from 'expo-crypto'
import * as ImagePicker from 'expo-image-picker'
import { useState } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { MainStackParamList, TagScanPhotoIds } from '../navigation/types'
import { useTagScanRepository } from './TagScanRepositoryContext'
import { getTagOcrAdapter } from './visionOcrAdapter'

type Step = 'front' | 'back'

/**
 * Guided two-step capture — front required, back optional — per issue #20's
 * design comment, itself motivated by ADR-0004's tag2 finding: a photo can
 * combine the front of one tag with the back of an *unrelated* one. Treating
 * front/back as two shots within one deliberate capture session (like a
 * check-deposit flow), rather than one freeform photo, structurally
 * prevents that mix-up rather than trying to detect it after the fact.
 *
 * OCR runs once, on the front photo, after the whole capture sequence
 * completes — see `getTagOcrAdapter()` (issue #22): Vision OCR when the
 * native module is actually built in, `manualEntryAdapter` (proposes
 * nothing, blank editable Review fields) everywhere else. Either way,
 * nothing is ever auto-applied — see packages/domain/src/tagScanCandidate.ts.
 */
export function TagScanCaptureScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const repository = useTagScanRepository()
  const [scanId] = useState(() => Crypto.randomUUID())
  const [step, setStep] = useState<Step>('front')
  const [frontTagPhotoId, setFrontTagPhotoId] = useState<string | null>(null)
  const [frontAssetUri, setFrontAssetUri] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function uploadStep(result: ImagePicker.ImagePickerResult) {
    if (result.canceled || result.assets.length === 0) return null
    const asset = result.assets[0]
    setBusy(true)
    setError(null)
    try {
      const tagPhoto = await repository.uploadTagPhoto(scanId, {
        uri: asset.uri,
        name: asset.fileName ?? `${scanId}-${step}.jpg`,
        mimeType: asset.mimeType ?? 'image/jpeg',
      })
      return { tagPhoto, asset }
    } catch {
      setError('Could not save that photo. Please try again.')
      return null
    } finally {
      setBusy(false)
    }
  }

  /**
   * A photo yielding more than one reading (e.g. ADR-0004's tag2 finding, or
   * a tag with two stapled inserts giving conflicting info) routes to a
   * disambiguation screen rather than silently taking the first candidate —
   * doing that silently would reproduce the exact failure mode ADR-0004
   * documented. An OCR failure (native module throws, or is unavailable)
   * degrades to manual entry rather than blocking the scan.
   */
  async function finishCapture(photoIds: TagScanPhotoIds) {
    if (!frontAssetUri) {
      navigation.navigate('TagScanReview', { scanId, photoIds })
      return
    }
    setBusy(true)
    try {
      const adapter = getTagOcrAdapter()
      const candidates = await adapter.recognize({ uri: frontAssetUri })
      const review = reviewTagOcrCandidates(adapter.source, candidates)
      if (review.candidates.length > 1) {
        navigation.navigate('TagScanMultipleReadings', { scanId, photoIds, candidates: review.candidates })
        return
      }
      navigation.navigate('TagScanReview', { scanId, photoIds, candidate: review.candidates[0] })
    } catch {
      navigation.navigate('TagScanReview', { scanId, photoIds })
    } finally {
      setBusy(false)
    }
  }

  async function handleCaptured(result: ImagePicker.ImagePickerResult) {
    const picked = await uploadStep(result)
    if (!picked) return

    if (step === 'front') {
      setFrontTagPhotoId(picked.tagPhoto.id)
      setFrontAssetUri(picked.asset.uri)
      setStep('back')
      return
    }

    if (frontTagPhotoId) {
      await finishCapture({ frontTagPhotoId, backTagPhotoId: picked.tagPhoto.id })
    }
  }

  async function requestAndLaunch(
    request: () => Promise<{ granted: boolean }>,
    launch: () => Promise<ImagePicker.ImagePickerResult>,
    deniedMessage: string,
  ) {
    const permission = await request()
    if (!permission.granted) {
      setError(deniedMessage)
      return
    }
    const result = await launch()
    await handleCaptured(result)
  }

  return (
    <SafeAreaView style={styles.container}>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] })}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
      <Text style={styles.title}>{step === 'front' ? 'Photograph the front' : 'Photograph the back'}</Text>
      <Text>
        {step === 'front'
          ? 'Frame the tag so the plant name is readable.'
          : 'Optional — add the back of the tag if it has more information, or skip.'}
      </Text>

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        style={styles.button}
        onPress={() =>
          requestAndLaunch(
            ImagePicker.requestCameraPermissionsAsync,
            () => ImagePicker.launchCameraAsync({ quality: 0.8 }),
            'Camera access is required to photograph a tag.',
          )
        }
      >
        <Text style={styles.buttonText}>Take photo</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        style={styles.buttonSecondary}
        onPress={() =>
          requestAndLaunch(
            ImagePicker.requestMediaLibraryPermissionsAsync,
            () => ImagePicker.launchImageLibraryAsync({ quality: 0.8 }),
            'Photo library access is required to choose a tag photo.',
          )
        }
      >
        <Text>Choose from library</Text>
      </Pressable>

      {step === 'back' && frontTagPhotoId && (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => finishCapture({ frontTagPhotoId })}
        >
          <Text>Skip — no back photo</Text>
        </Pressable>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
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
  },
  error: {
    color: '#b00020',
  },
  cancelText: {
    color: '#2e7d32',
  },
})
