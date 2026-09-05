import { NavigationContainer, useNavigation } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as ImagePicker from 'expo-image-picker'
import { Alert, Pressable, Text, View } from 'react-native'
import { PlantsRepositoryProvider } from '../plants/PlantsRepositoryContext'
import { SpeciesLookupRepositoryProvider } from '../species/SpeciesLookupRepositoryContext'
import { createFakePlantsDbClient } from '../test/fakePlantsDbClient'
import { createFakeSpeciesLookupDbClient } from '../test/fakeSpeciesLookupDbClient'
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
    <View>
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('PlantDetail', { plantId: 'plant-1' })}
      >
        <Text>registry screen</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('PlantDetail')}>
        <Text>add plant</Text>
      </Pressable>
    </View>
  )
}

function createFakes(plantRows = [plantRow({ id: 'plant-1' })]) {
  const plants = createFakePlantsDbClient(plantRows)
  const species = createFakeSpeciesLookupDbClient()
  return { ...plants, speciesClient: species.client, functionsInvoke: species.functionsInvoke }
}

async function renderFlow(fake: ReturnType<typeof createFakes>, entryPoint: string) {
  await render(
    <SpeciesLookupRepositoryProvider client={fake.speciesClient}>
      <PlantsRepositoryProvider client={fake.client}>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Registry" component={RegistryStub} />
            <Stack.Screen name="PlantDetail" component={PlantDetailScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </PlantsRepositoryProvider>
    </SpeciesLookupRepositoryProvider>,
  )
  await fireEvent.press(screen.getByText(entryPoint))
  return fake
}

async function renderScreen(fake = createFakes()) {
  return renderFlow(fake, 'registry screen')
}

/** Arrives at the same screen with no `plantId` — the manual creation path (#31). */
async function renderCreateScreen(fake = createFakes([])) {
  return renderFlow(fake, 'add plant')
}

describe('PlantDetailScreen', () => {
  it("loads and shows the Plant's fields", async () => {
    await renderScreen(
      createFakes([
        plantRow({ id: 'plant-1', common_name: 'Coneflower', scientific_name: 'Echinacea purpurea' }),
      ]),
    )

    expect(await screen.findByDisplayValue('Coneflower')).toBeTruthy()
    expect(screen.getByDisplayValue('Echinacea purpurea')).toBeTruthy()
  })

  it('shows an error when the Plant does not exist', async () => {
    await renderScreen(createFakes([]))

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
      createFakes([
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

describe('PlantDetailScreen in create mode (#31)', () => {
  it('starts from an empty form, with no Delete or photo actions to reach yet', async () => {
    await renderCreateScreen()

    expect(await screen.findByRole('header', { name: 'Add Plant' })).toBeTruthy()
    expect(screen.getByLabelText('Common name').props.value).toBe('')
    expect(screen.queryByText('Delete Plant')).toBeNull()
    expect(screen.queryByText('Reference photos')).toBeNull()
    expect(screen.queryByText('Take photo')).toBeNull()
  })

  it('creates the Plant on save and stays on it, now with Delete and photo actions', async () => {
    const fake = await renderCreateScreen()
    await screen.findByRole('header', { name: 'Add Plant' })

    await fireEvent.changeText(screen.getByLabelText('Common name'), 'Bee balm')
    await fireEvent.changeText(screen.getByLabelText('Scientific name'), 'Monarda didyma')
    await fireEvent.press(screen.getByRole('button', { name: 'Add Plant' }))

    await waitFor(() => expect(screen.getByText('Saved.')).toBeTruthy())
    expect(fake.rows()).toEqual([
      expect.objectContaining({ common_name: 'Bee balm', scientific_name: 'Monarda didyma' }),
    ])
    // Same route, same screen — it is simply an existing Plant now.
    expect(screen.getByText('Delete Plant')).toBeTruthy()
    expect(screen.getByText('Reference photos')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy()
  })

  it('rejects invalid input through the same inline validation editing uses', async () => {
    const fake = await renderCreateScreen()
    await screen.findByRole('header', { name: 'Add Plant' })

    await fireEvent.changeText(screen.getByLabelText('Common name'), 'Bee balm')
    await fireEvent.press(screen.getByRole('button', { name: 'Add Plant' }))

    expect(await screen.findByText('Fix the highlighted fields above.')).toBeTruthy()
    expect(fake.rows()).toHaveLength(0)
  })

  it('fills the scientific name from the same USDA lookup Tag Scan offers', async () => {
    const fake = await renderCreateScreen()
    await screen.findByRole('header', { name: 'Add Plant' })
    fake.functionsInvoke.mockResolvedValueOnce({
      data: { species: [{ scientificName: 'Monarda didyma', commonName: 'bee balm' }] },
      error: null,
    })

    await fireEvent.changeText(screen.getByLabelText('Common name'), 'bee balm')
    await fireEvent.press(screen.getByRole('button', { name: 'Look up species' }))

    await waitFor(() =>
      expect(screen.getByLabelText('Scientific name').props.value).toBe('Monarda didyma'),
    )
  })

  it('never guesses an ambiguous common name — it lists the candidates to pick from', async () => {
    const fake = await renderCreateScreen()
    await screen.findByRole('header', { name: 'Add Plant' })
    fake.functionsInvoke.mockResolvedValueOnce({
      data: {
        species: [
          { scientificName: 'Liatris spicata', commonName: 'liatris' },
          { scientificName: 'Liatris aspera', commonName: 'liatris' },
        ],
      },
      error: null,
    })

    await fireEvent.changeText(screen.getByLabelText('Common name'), 'liatris')
    await fireEvent.press(screen.getByRole('button', { name: 'Look up species' }))

    await screen.findByLabelText('Species candidates')
    expect(screen.getByLabelText('Scientific name').props.value).toBe('')

    await fireEvent.press(screen.getByText('Liatris aspera'))

    expect(screen.getByLabelText('Scientific name').props.value).toBe('Liatris aspera')
    expect(screen.queryByLabelText('Species candidates')).toBeNull()
  })

  it('offers USDA trait suggestions before creating, and applies them only when accepted', async () => {
    const fake = await renderCreateScreen()
    await screen.findByRole('header', { name: 'Add Plant' })
    fake.functionsInvoke.mockResolvedValueOnce({
      data: {
        species: [],
        characteristics: [
          { name: 'Shade Tolerance', value: 'None' },
          { name: 'Height, Mature (feet)', value: '4.0' },
        ],
      },
      error: null,
    })

    await fireEvent.changeText(screen.getByLabelText('Common name'), 'Bee balm')
    await fireEvent.changeText(screen.getByLabelText('Scientific name'), 'Monarda didyma')
    await fireEvent.press(screen.getByRole('button', { name: 'Add Plant' }))

    await screen.findByText('Suggested traits')
    expect(fake.rows()).toHaveLength(0) // nothing written until the user decides

    await fireEvent.press(screen.getByRole('button', { name: 'Use these suggested traits' }))

    await waitFor(() => expect(fake.rows()).toHaveLength(1))
    expect(fake.rows()[0]).toEqual(
      expect.objectContaining({ sun_requirement: 'full-sun', mature_height_inches: 48 }),
    )
  })

  it('never offers to overwrite a trait the user filled in themselves', async () => {
    const fake = await renderCreateScreen()
    await screen.findByRole('header', { name: 'Add Plant' })
    fake.functionsInvoke.mockResolvedValueOnce({
      data: {
        species: [],
        characteristics: [
          { name: 'Shade Tolerance', value: 'None' }, // → full-sun
          { name: 'Height, Mature (feet)', value: '4.0' }, // → 48"
        ],
      },
      error: null,
    })

    await fireEvent.changeText(screen.getByLabelText('Common name'), 'Bee balm')
    await fireEvent.changeText(screen.getByLabelText('Scientific name'), 'Monarda didyma')
    await fireEvent.press(screen.getByRole('button', { name: 'full shade' }))
    await fireEvent.changeText(screen.getByLabelText('Mature height'), '36')
    await fireEvent.press(screen.getByRole('button', { name: 'Add Plant' }))

    // Both suggestions are already answered, so there is nothing to confirm —
    // it saves straight through, keeping what the user chose.
    await waitFor(() => expect(fake.rows()).toHaveLength(1))
    expect(screen.queryByText('Suggested traits')).toBeNull()
    expect(fake.rows()[0]).toEqual(
      expect.objectContaining({ sun_requirement: 'full-shade', mature_height_inches: 36 }),
    )
  })

  it('creates the Plant as typed when the trait suggestion is skipped', async () => {
    const fake = await renderCreateScreen()
    await screen.findByRole('header', { name: 'Add Plant' })
    fake.functionsInvoke.mockResolvedValueOnce({
      data: { species: [], characteristics: [{ name: 'Shade Tolerance', value: 'None' }] },
      error: null,
    })

    await fireEvent.changeText(screen.getByLabelText('Common name'), 'Bee balm')
    await fireEvent.changeText(screen.getByLabelText('Scientific name'), 'Monarda didyma')
    await fireEvent.press(screen.getByRole('button', { name: 'Add Plant' }))
    await screen.findByText('Suggested traits')

    await fireEvent.press(screen.getByRole('button', { name: 'Skip suggested traits' }))

    await waitFor(() => expect(fake.rows()).toHaveLength(1))
    expect(fake.rows()[0].sun_requirement).toBeNull()
  })

  it('still creates the Plant when the USDA lookup fails — a lookup forfeits the suggestion, not the save', async () => {
    const fake = await renderCreateScreen()
    await screen.findByRole('header', { name: 'Add Plant' })
    fake.functionsInvoke.mockRejectedValueOnce(new Error('network down'))

    await fireEvent.changeText(screen.getByLabelText('Common name'), 'Bee balm')
    await fireEvent.changeText(screen.getByLabelText('Scientific name'), 'Monarda didyma')
    await fireEvent.press(screen.getByRole('button', { name: 'Add Plant' }))

    await waitFor(() => expect(screen.getByText('Saved.')).toBeTruthy())
    expect(fake.rows()).toHaveLength(1)
  })
})
