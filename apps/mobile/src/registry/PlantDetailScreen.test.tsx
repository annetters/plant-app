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
