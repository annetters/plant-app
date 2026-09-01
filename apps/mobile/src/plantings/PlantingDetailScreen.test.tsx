import { NavigationContainer, useNavigation } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as ImagePicker from 'expo-image-picker'
import { Alert, Pressable, Text } from 'react-native'
import { PlantsRepositoryProvider } from '../plants/PlantsRepositoryContext'
import { BedsRepositoryProvider } from '../property/BedsRepositoryContext'
import { PropertiesRepositoryProvider } from '../property/PropertiesRepositoryContext'
import { bedRow } from '../test/bedRowFixture'
import { createFakeBedsDbClient } from '../test/fakeBedsDbClient'
import { createFakePlantingsDbClient } from '../test/fakePlantingsDbClient'
import { createFakePlantsDbClient } from '../test/fakePlantsDbClient'
import { createFakePropertiesDbClient } from '../test/fakePropertiesDbClient'
import { plantRow } from '../test/plantRowFixture'
import { plantingRow } from '../test/plantingRowFixture'
import { propertyRow } from '../test/propertyRowFixture'
import { PlantingDetailScreen } from './PlantingDetailScreen'
import { PlantingsRepositoryProvider } from './PlantingsRepositoryContext'

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
      onPress={() => navigation.navigate('PlantingDetail', { plantingId: 'planting-1' })}
    >
      <Text>registry screen</Text>
    </Pressable>
  )
}

async function renderScreen({
  plantingsFake = createFakePlantingsDbClient([plantingRow({ id: 'planting-1', bed_id: 'bed-1' })]),
  plantsFake = createFakePlantsDbClient([plantRow({ id: 'plant-existing', common_name: 'Coneflower' })]),
  property = propertyRow({ id: 'property-1' }),
  bedRows = [bedRow({ id: 'bed-1', property_id: 'property-1', name: 'Front border' })],
}: {
  plantingsFake?: ReturnType<typeof createFakePlantingsDbClient>
  plantsFake?: ReturnType<typeof createFakePlantsDbClient>
  property?: ReturnType<typeof propertyRow> | null
  bedRows?: ReturnType<typeof bedRow>[]
} = {}) {
  await render(
    <PropertiesRepositoryProvider client={createFakePropertiesDbClient(property).client}>
      <BedsRepositoryProvider client={createFakeBedsDbClient(bedRows).client}>
        <PlantsRepositoryProvider client={plantsFake.client}>
          <PlantingsRepositoryProvider client={plantingsFake.client}>
            <NavigationContainer>
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Registry" component={RegistryStub} />
                <Stack.Screen name="PlantingDetail" component={PlantingDetailScreen} />
              </Stack.Navigator>
            </NavigationContainer>
          </PlantingsRepositoryProvider>
        </PlantsRepositoryProvider>
      </BedsRepositoryProvider>
    </PropertiesRepositoryProvider>,
  )
  await fireEvent.press(screen.getByText('registry screen'))
  return { plantingsFake, plantsFake }
}

describe('PlantingDetailScreen', () => {
  it("shows the Planting's fields and Bed name", async () => {
    await renderScreen({
      plantingsFake: createFakePlantingsDbClient([
        plantingRow({ id: 'planting-1', bed_id: 'bed-1', quantity: 3, source_nursery: 'Bluebird Farm' }),
      ]),
    })

    expect(await screen.findByText('Coneflower')).toBeTruthy()
    expect(screen.getByText('Quantity: 3')).toBeTruthy()
    expect(screen.getByText('Source: Bluebird Farm')).toBeTruthy()
    expect(screen.getByText('In Front border')).toBeTruthy()
  })

  it('shows an error when the Planting does not exist', async () => {
    await renderScreen({ plantingsFake: createFakePlantingsDbClient([]) })

    expect(await screen.findByText('This Planting could not be found.')).toBeTruthy()
  })

  it('adds a dated photo taken with the camera', async () => {
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: true } as never)
    jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///bloom.jpg', fileName: 'bloom.jpg', mimeType: 'image/jpeg' }],
    } as never)
    const { plantingsFake } = await renderScreen()
    await screen.findByText('Coneflower')

    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }))

    await waitFor(() => expect(plantingsFake.photoRows()).toHaveLength(1))
  })

  it('removes a dated photo from the log', async () => {
    const plantingsFake = createFakePlantingsDbClient(
      [plantingRow({ id: 'planting-1', bed_id: 'bed-1' })],
      [
        {
          id: 'photo-1',
          planting_id: 'planting-1',
          storage_path: 'user-1/planting-1/a.jpg',
          taken_on: '2026-05-01',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    )
    await renderScreen({ plantingsFake })
    await screen.findByText('Coneflower')

    await fireEvent.press(await screen.findByText('Remove'))

    await waitFor(() => expect(plantingsFake.photoRows()).toHaveLength(0))
  })

  it('removes the Planting after confirming, and navigates back', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const removeButton = buttons?.find((button) => button.style === 'destructive')
      removeButton?.onPress?.()
    })
    const { plantingsFake } = await renderScreen()
    await screen.findByText('Coneflower')

    await fireEvent.press(screen.getByRole('button', { name: 'Remove Planting' }))

    await waitFor(() => expect(screen.getByText('registry screen')).toBeTruthy())
    expect(plantingsFake.plantingRows()).toHaveLength(0)
  })
})
