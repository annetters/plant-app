import { NavigationContainer, useNavigation } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as ImagePicker from 'expo-image-picker'
import { Alert, Pressable, Text } from 'react-native'
import { PlantsRepositoryProvider } from '../plants/PlantsRepositoryContext'
import { createFakePlantsDbClient } from '../test/fakePlantsDbClient'
import { plantRow } from '../test/plantRowFixture'
import { PlantDetailScreen } from './PlantDetailScreen'

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}))

// pickPhoto() re-encodes every picked photo to JPEG — see pickPhoto.test.ts
// for coverage of that conversion itself. Here it's a pass-through so these
// screen-level tests aren't coupled to expo-image-manipulator's API shape.
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: {
    manipulate: jest.fn((uri: string) => ({
      renderAsync: () => Promise.resolve({ saveAsync: () => Promise.resolve({ uri }) }),
    })),
  },
  SaveFormat: { JPEG: 'jpeg' },
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

function RegistryStub() {
  const navigation = useNavigation<any>()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => navigation.navigate('PlantDetail', { plantId: 'plant-1' })}
    >
      <Text>registry screen</Text>
    </Pressable>
  )
}

async function renderScreen(fake = createFakePlantsDbClient([plantRow({ id: 'plant-1' })])) {
  await render(
    <PlantsRepositoryProvider client={fake.client}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Registry" component={RegistryStub} />
          <Stack.Screen name="PlantDetail" component={PlantDetailScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </PlantsRepositoryProvider>,
  )
  await fireEvent.press(screen.getByText('registry screen'))
  return fake
}

describe('PlantDetailScreen', () => {
  it("loads and shows the Plant's fields", async () => {
    await renderScreen(
      createFakePlantsDbClient([
        plantRow({ id: 'plant-1', common_name: 'Coneflower', scientific_name: 'Echinacea purpurea' }),
      ]),
    )

    expect(await screen.findByDisplayValue('Coneflower')).toBeTruthy()
    expect(screen.getByDisplayValue('Echinacea purpurea')).toBeTruthy()
  })

  it('shows an error when the Plant does not exist', async () => {
    await renderScreen(createFakePlantsDbClient([]))

    expect(await screen.findByText('Plant not found.')).toBeTruthy()
  })

  it('saves an edited field', async () => {
    const fake = await renderScreen()
    await screen.findByDisplayValue('Coneflower')

    await fireEvent.changeText(screen.getByLabelText('Common name'), 'Purple Coneflower')
    await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(screen.getByText('Saved.')).toBeTruthy())
    expect(fake.rows()[0].common_name).toBe('Purple Coneflower')
  })

  it('caps the bloom window fields at 2 digits — a month or day never needs a 3rd', async () => {
    await renderScreen()
    await screen.findByDisplayValue('Coneflower')

    for (const label of ['Bloom start month', 'Bloom start day', 'Bloom end month', 'Bloom end day']) {
      expect(screen.getByLabelText(label).props.maxLength).toBe(2)
    }
  })

  it('shows a summary error and scrolls back up when Save fails validation on a field scrolled out of view', async () => {
    const fake = await renderScreen()
    await screen.findByDisplayValue('Coneflower')

    await fireEvent.changeText(screen.getByLabelText('Common name'), '')
    await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Fix the highlighted fields above.')).toBeTruthy()
    expect(fake.rows()[0].common_name).toBe('Coneflower')
  })

  it('shows an uploading label on the pressed button while a photo upload is in flight', async () => {
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: true } as never)
    jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///leaf.jpg', fileName: 'leaf.jpg', mimeType: 'image/jpeg' }],
    } as never)
    const fake = await renderScreen()
    await screen.findByDisplayValue('Coneflower')
    let resolveUpload: () => void = () => {}
    fake.storage.upload.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUpload = () => resolve({ data: { path: 'fake/path.jpg' }, error: null })
        }),
    )

    fireEvent.press(screen.getByRole('button', { name: 'Take photo' }))

    expect(await screen.findByText('Uploading…')).toBeTruthy()
    expect(screen.getByText('Choose from library')).toBeTruthy()
    resolveUpload()
    await waitFor(() => expect(screen.getByText('Photo added.')).toBeTruthy())
  })

  it('uploads a reference photo taken with the camera', async () => {
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: true } as never)
    jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///leaf.jpg', fileName: 'leaf.jpg', mimeType: 'image/jpeg' }],
    } as never)
    const fake = await renderScreen()
    await screen.findByDisplayValue('Coneflower')

    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }))

    await waitFor(() => expect(screen.getByText('Photo added.')).toBeTruthy())
    expect(fake.rows()[0].reference_photo_paths).toHaveLength(1)
  })

  it('removes a reference photo', async () => {
    const fake = await renderScreen(
      createFakePlantsDbClient([
        plantRow({ id: 'plant-1', reference_photo_paths: ['user-1/plant-1/a.jpg'] }),
      ]),
    )
    await screen.findByDisplayValue('Coneflower')

    await fireEvent.press(await screen.findByText('Remove'))

    await waitFor(() => expect(screen.getByText('Photo removed.')).toBeTruthy())
    expect(fake.rows()[0].reference_photo_paths).toEqual([])
  })

  it('deletes the Plant after confirming, and navigates back', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const deleteButton = buttons?.find((button) => button.style === 'destructive')
      deleteButton?.onPress?.()
    })
    const fake = await renderScreen()
    await screen.findByDisplayValue('Coneflower')

    await fireEvent.press(screen.getByRole('button', { name: 'Delete Plant' }))

    await waitFor(() => expect(screen.getByText('registry screen')).toBeTruthy())
    expect(fake.rows()).toHaveLength(0)
  })
})
