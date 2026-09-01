import * as ImagePicker from 'expo-image-picker'

export interface PickedPhoto {
  uri: string
  name: string
  mimeType: string
}

export type PhotoSource = 'camera' | 'library'

/**
 * Requests permission and launches either the camera or the photo library,
 * returning the picked photo or `null` if the user cancelled. Throws with a
 * user-facing message if permission is denied. Shared by every screen that
 * lets a gardener attach a photo — factored out here once a second/third
 * screen (Plant reference photos, a Planting's dated photo log) needed the
 * same permission-then-launch dance `TagScanCaptureScreen` already has
 * inline for its own two-step guided capture.
 */
export async function pickPhoto(source: PhotoSource): Promise<PickedPhoto | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) {
    throw new Error(
      source === 'camera'
        ? 'Camera access is required to take a photo.'
        : 'Photo library access is required to choose a photo.',
    )
  }

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8 })
  if (result.canceled || result.assets.length === 0) return null

  const asset = result.assets[0]
  return {
    uri: asset.uri,
    name: asset.fileName ?? `photo-${Date.now()}.jpg`,
    mimeType: asset.mimeType ?? 'image/jpeg',
  }
}
