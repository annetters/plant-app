import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as ImagePicker from 'expo-image-picker'
import { Text } from 'react-native'
import { createFakeTagScanDbClient } from '../test/fakeTagScanDbClient'
import { TagScanCaptureScreen } from './TagScanCaptureScreen'
import { TagScanRepositoryProvider } from './TagScanRepositoryContext'

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}))

const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  }) as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

const Stack = createNativeStackNavigator()

async function renderCaptureFlow(fake = createFakeTagScanDbClient()) {
  await render(
    <TagScanRepositoryProvider client={fake.client}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="TagScanCapture" component={TagScanCaptureScreen} />
          <Stack.Screen name="TagScanReview">
            {({ route }: any) => <Text>review: {JSON.stringify(route.params)}</Text>}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </TagScanRepositoryProvider>,
  )
  return fake
}

function mockCameraCapture(uri: string, fileName: string) {
  jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: true } as never)
  jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri, fileName, mimeType: 'image/jpeg' }],
  } as never)
}

describe('TagScanCaptureScreen', () => {
  it('asks for the front photo first, required, before offering a back-photo step', async () => {
    await renderCaptureFlow()

    expect(await screen.findByText('Photograph the front')).toBeTruthy()
    expect(screen.queryByText(/Skip — no back photo/)).toBeNull()
  })

  it('guides front then optional back, uploading each as a separate tag photo, and navigates with both ids', async () => {
    const fake = await renderCaptureFlow()
    mockCameraCapture('file:///front.jpg', 'front.jpg')

    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }))

    expect(await screen.findByText('Photograph the back')).toBeTruthy()
    expect(fake.tagPhotoRows()).toHaveLength(1)

    mockCameraCapture('file:///back.jpg', 'back.jpg')
    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }))

    const reviewText = await screen.findByText(/review:/)
    expect(fake.tagPhotoRows()).toHaveLength(2)
    const params = JSON.parse(reviewText.props.children.join('').replace('review: ', ''))
    expect(params.photoIds).toEqual({
      frontTagPhotoId: fake.tagPhotoRows()[0].id,
      backTagPhotoId: fake.tagPhotoRows()[1].id,
    })
    expect(params.candidate).toBeUndefined() // manual-entry adapter proposes nothing
  })

  it('lets the user skip the back photo — it is optional, not required', async () => {
    const fake = await renderCaptureFlow()
    mockCameraCapture('file:///front.jpg', 'front.jpg')
    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }))
    await screen.findByText('Photograph the back')

    await fireEvent.press(screen.getByRole('button', { name: 'Skip — no back photo' }))

    const reviewText = await screen.findByText(/review:/)
    const params = JSON.parse(reviewText.props.children.join('').replace('review: ', ''))
    expect(params.photoIds).toEqual({ frontTagPhotoId: fake.tagPhotoRows()[0].id })
    expect(fake.tagPhotoRows()).toHaveLength(1)
  })

  it('shows an error and does not advance to the back step when camera permission is denied', async () => {
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: false } as never)
    const fake = await renderCaptureFlow()

    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }))

    expect(await screen.findByText('Camera access is required to photograph a tag.')).toBeTruthy()
    expect(fake.tagPhotoRows()).toHaveLength(0)
    expect(screen.queryByText('Photograph the back')).toBeNull()
  })

  it('does nothing when the user cancels the picker', async () => {
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({ granted: true } as never)
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: true } as never)
    const fake = await renderCaptureFlow()

    await fireEvent.press(screen.getByRole('button', { name: 'Choose from library' }))

    await waitFor(() => expect(screen.queryByText('Photograph the back')).toBeNull())
    expect(fake.tagPhotoRows()).toHaveLength(0)
  })
})
