import { manualEntryAdapter, reviewTagOcrCandidates, type TagOcrCandidateFields } from '@plant-app/domain'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as Crypto from 'expo-crypto'
import * as ImagePicker from 'expo-image-picker'
import { useState } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { MainStackParamList, TagScanPhotoIds } from '../navigation/types'
import { useTagScanRepository } from './TagScanRepositoryContext'

type Step = 'front' | 'back'

/**
 * Guided two-step capture — front required, back optional — per issue #20's
 * design comment, itself motivated by ADR-0004's tag2 finding: a photo can
 * combine the front of one tag with the back of an *unrelated* one. Treating
 * front/back as two shots within one deliberate capture session (like a
 * check-deposit flow), rather than one freeform photo, structurally
 * prevents that mix-up rather than trying to detect it after the fact.
 *
 * `manualEntryAdapter` is the real OCR seam for this pass (see ADR-0004 and
 * packages/domain/src/tagScanCandidate.ts) — it always resolves to no
 * candidates, so Review always renders blank, user-filled fields. The
 * on-device Vision-framework adapter is tracked separately (#22 — needs a
 * native module, an EAS dev client build, and a physical device to test
 * against real tags, none of which an AFK coding session can do) and plugs
 * into the same `TagOcrAdapter` interface without this screen changing.
 */
export function TagScanCaptureScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const repository = useTagScanRepository()
  const [scanId] = useState(() => Crypto.randomUUID())
  const [step, setStep] = useState<Step>('front')
  const [frontTagPhotoId, setFrontTagPhotoId] = useState<string | null>(null)
  const [candidate, setCandidate] = useState<TagOcrCandidateFields | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function goToReview(photoIds: TagScanPhotoIds) {
    navigation.navigate('TagScanReview', { scanId, photoIds, candidate })
  }

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

  async function handleCaptured(result: ImagePicker.ImagePickerResult) {
    const picked = await uploadStep(result)
    if (!picked) return

    if (step === 'front') {
      const candidates = await manualEntryAdapter.recognize({ uri: picked.asset.uri })
      // manualEntryAdapter never returns more than zero candidates, so taking
      // the first is a no-op today. A real OCR adapter *could* surface more
      // than one reading (e.g. a tag with two stapled inserts giving
      // conflicting info, ADR-0004's tag7 finding) — deciding how to
      // disambiguate that is left to #22, which implements that adapter.
      const review = reviewTagOcrCandidates(manualEntryAdapter.source, candidates)
      setCandidate(review.candidates[0])
      setFrontTagPhotoId(picked.tagPhoto.id)
      setStep('back')
      return
    }

    if (frontTagPhotoId) {
      goToReview({ frontTagPhotoId, backTagPhotoId: picked.tagPhoto.id })
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
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => goToReview({ frontTagPhotoId })}>
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
})
