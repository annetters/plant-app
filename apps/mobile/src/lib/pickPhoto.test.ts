import * as ImagePicker from 'expo-image-picker'
import { pickPhoto } from './pickPhoto'

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}))

describe('pickPhoto', () => {
  it('returns the picked asset from the camera', async () => {
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: true } as never)
    jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///leaf.jpg', fileName: 'leaf.jpg', mimeType: 'image/jpeg' }],
    } as never)

    const photo = await pickPhoto('camera')

    expect(photo).toEqual({ uri: 'file:///leaf.jpg', name: 'leaf.jpg', mimeType: 'image/jpeg' })
  })

  it('returns the picked asset from the library', async () => {
    jest
      .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
      .mockResolvedValue({ granted: true } as never)
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///bloom.jpg', fileName: 'bloom.jpg', mimeType: 'image/jpeg' }],
    } as never)

    const photo = await pickPhoto('library')

    expect(photo).toEqual({ uri: 'file:///bloom.jpg', name: 'bloom.jpg', mimeType: 'image/jpeg' })
  })

  it('returns null when the user cancels the picker', async () => {
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: true } as never)
    jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({ canceled: true } as never)

    expect(await pickPhoto('camera')).toBeNull()
  })

  it('throws a user-facing message when camera permission is denied', async () => {
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: false } as never)

    await expect(pickPhoto('camera')).rejects.toThrow('Camera access is required to take a photo.')
  })

  it('throws a user-facing message when library permission is denied', async () => {
    jest
      .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
      .mockResolvedValue({ granted: false } as never)

    await expect(pickPhoto('library')).rejects.toThrow(
      'Photo library access is required to choose a photo.',
    )
  })

  it('falls back to a generated name and jpeg mime type when the asset omits them', async () => {
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: true } as never)
    jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///photo.jpg' }],
    } as never)

    const photo = await pickPhoto('camera')

    expect(photo?.mimeType).toBe('image/jpeg')
    expect(photo?.name).toMatch(/^photo-\d+\.jpg$/)
  })
})
