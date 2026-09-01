import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'

export interface PickedPhoto {
  uri: string
  name: string
  mimeType: string
}

export type PhotoSource = 'camera' | 'library'

/**
 * iOS's camera defaults to HEIC (Apple's own format, unless the device's
 * Camera Format setting is "Most Compatible") — Expo's picker hands that
 * format straight back, uri and all. Chrome/Firefox/Edge can't decode HEIC
 * in an `<img>` tag at all, so a photo captured on the phone and later
 * viewed on web renders as a broken image with no intrinsic height, no
 * matter what the caller does with it. Re-encoding every picked photo to
 * JPEG here, once, regardless of its original format, means nothing
 * downstream (upload, storage, every `<img>`/`Image` consumer on either
 * platform) ever has to special-case HEIC.
 */
async function toJpeg(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri)
  const rendered = await context.renderAsync()
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 })
  return result.uri
}

function jpegFileName(originalName: string | null | undefined): string {
  const base = (originalName ?? `photo-${Date.now()}`).replace(/\.[^./]+$/, '')
  return `${base}.jpg`
}

/**
 * Requests permission and launches either the camera or the photo library,
 * returning the picked photo (always normalized to JPEG — see `toJpeg`) or
 * `null` if the user cancelled. Throws with a user-facing message if
 * permission is denied. Shared by every screen that lets a gardener attach
 * a photo — factored out here once a second/third screen (Plant reference
 * photos, a Planting's dated photo log) needed the same
 * permission-then-launch dance `TagScanCaptureScreen` already has inline
 * for its own two-step guided capture.
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
  const jpegUri = await toJpeg(asset.uri)
  return {
    uri: jpegUri,
    name: jpegFileName(asset.fileName),
    mimeType: 'image/jpeg',
  }
}
