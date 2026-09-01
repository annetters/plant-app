import { ImageManipulator } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { pickPhoto } from './pickPhoto'

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}))

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}))

const mockSaveAsync = jest.fn()
const mockRenderAsync = jest.fn()

beforeEach(() => {
  mockSaveAsync.mockReset().mockResolvedValue({ uri: 'file:///converted.jpg' })
  mockRenderAsync.mockReset().mockResolvedValue({ saveAsync: mockSaveAsync })
  jest
    .mocked(ImageManipulator.manipulate)
    .mockClear()
    .mockReturnValue({ renderAsync: mockRenderAsync } as never)
})

describe('pickPhoto', () => {
  it('re-encodes the picked photo to JPEG, regardless of its original format', async () => {
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: true } as never)
    jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///IMG_1234.HEIC', fileName: 'IMG_1234.HEIC', mimeType: 'image/heic' }],
    } as never)

    const photo = await pickPhoto('camera')

    expect(ImageManipulator.manipulate).toHaveBeenCalledWith('file:///IMG_1234.HEIC')
    expect(mockSaveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.8 })
    expect(photo).toEqual({ uri: 'file:///converted.jpg', name: 'IMG_1234.jpg', mimeType: 'image/jpeg' })
  })

  it('returns the converted asset from the library', async () => {
    jest
      .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
      .mockResolvedValue({ granted: true } as never)
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///bloom.png', fileName: 'bloom.png', mimeType: 'image/png' }],
    } as never)

    const photo = await pickPhoto('library')

    expect(photo).toEqual({ uri: 'file:///converted.jpg', name: 'bloom.jpg', mimeType: 'image/jpeg' })
  })

  it('returns null when the user cancels the picker', async () => {
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: true } as never)
    jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({ canceled: true } as never)

    expect(await pickPhoto('camera')).toBeNull()
    expect(ImageManipulator.manipulate).not.toHaveBeenCalled()
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

  it('falls back to a generated name when the asset omits one', async () => {
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
