import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { PlantRow } from '@plant-app/domain'
import type { ReactNode } from 'react'
import { Text } from 'react-native'
import { SpeciesLookupRepositoryProvider } from '../species/SpeciesLookupRepositoryContext'
import { createFakeSpeciesLookupDbClient } from '../test/fakeSpeciesLookupDbClient'
import { createFakeTagScanDbClient } from '../test/fakeTagScanDbClient'
import { plantRow } from '../test/plantRowFixture'
import { TagScanAmbiguousSpeciesScreen } from './TagScanAmbiguousSpeciesScreen'
import { TagScanReviewScreen } from './TagScanReviewScreen'
import { TagScanRepositoryProvider } from './TagScanRepositoryContext'

const Stack = createNativeStackNavigator()

const defaultPhotoIds = { frontTagPhotoId: 'tag-photo-1' }

/**
 * This screen reads its Plants through TagScanRepository and its USDA
 * species lookup through SpeciesLookupRepository (#31 moved the lookup out
 * so the manual Plant form could share it), so it needs both fakes.
 * `functionsInvoke` drives the lookup.
 */
function createFakes(
  initialPlantRows: PlantRow[] = [],
  initialTagPhotoRows: Record<string, unknown>[] = [],
) {
  const tagScan = createFakeTagScanDbClient(initialPlantRows, initialTagPhotoRows)
  const species = createFakeSpeciesLookupDbClient()
  return { ...tagScan, speciesClient: species.client, functionsInvoke: species.functionsInvoke }
}

function Providers({ fake, children }: { fake: ReturnType<typeof createFakes>; children: ReactNode }) {
  return (
    <SpeciesLookupRepositoryProvider client={fake.speciesClient}>
      <TagScanRepositoryProvider client={fake.client}>{children}</TagScanRepositoryProvider>
    </SpeciesLookupRepositoryProvider>
  )
}

async function renderReviewFlow(
  fake = createFakes(),
  initialParams: Record<string, unknown> = { scanId: 'scan-1', photoIds: defaultPhotoIds },
) {
  await render(
    <Providers fake={fake}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="TagScanReview" component={TagScanReviewScreen} initialParams={initialParams} />
          <Stack.Screen name="TagScanAmbiguousSpecies">
            {({ route }: any) => <Text>ambiguous: {JSON.stringify(route.params)}</Text>}
          </Stack.Screen>
          <Stack.Screen name="TagScanDuplicateOffer">
            {({ route }: any) => <Text>duplicate: {JSON.stringify(route.params)}</Text>}
          </Stack.Screen>
          <Stack.Screen name="Dashboard">{() => <Text>dashboard screen</Text>}</Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </Providers>,
  )
  return fake
}

function tagPhotoRow(id: string) {
  return { id, user_id: 'user-1', storage_path: `user-1/scan-1/${id}.jpg` }
}

async function waitUntilPlantsLoaded() {
  await waitFor(() => expect(screen.queryByText(/Checking your existing Plants/)).toBeNull())
}

describe('TagScanReviewScreen', () => {
  it('renders blank editable fields when there is no OCR candidate — manual entry is the complete fallback', async () => {
    await renderReviewFlow()
    await waitFor(() => expect(screen.getByLabelText('Common name')).toBeTruthy())

    expect(screen.getByLabelText('Common name').props.value).toBe('')
    expect(screen.getByLabelText('Scientific name').props.value).toBe('')
    expect(screen.getByLabelText('Cultivar').props.value).toBe('')
  })

  it('pre-fills fields from an OCR candidate, still fully editable', async () => {
    await renderReviewFlow(createFakes(), {
      scanId: 'scan-1',
      photoIds: defaultPhotoIds,
      candidate: { commonName: 'Bee balm', scientificName: 'Monarda didyma', cultivar: 'Gateway' },
    })
    await waitFor(() => expect(screen.getByLabelText('Common name')).toBeTruthy())

    expect(screen.getByLabelText('Common name').props.value).toBe('Bee balm')
    expect(screen.getByLabelText('Scientific name').props.value).toBe('Monarda didyma')
    expect(screen.getByLabelText('Cultivar').props.value).toBe('Gateway')
  })

  it('surfaces an ambiguous common name as distinct species candidates instead of guessing', async () => {
    const fake = await renderReviewFlow()
    fake.functionsInvoke.mockResolvedValueOnce({
      data: {
        species: [
          { scientificName: 'Monarda didyma', commonName: 'bee balm' },
          { scientificName: 'Monarda fistulosa', commonName: 'bee balm' },
        ],
      },
      error: null,
    })
    await waitFor(() => expect(screen.getByLabelText('Common name')).toBeTruthy())

    await fireEvent.changeText(screen.getByLabelText('Common name'), 'bee balm')
    await fireEvent.press(screen.getByRole('button', { name: 'Look up species' }))

    const ambiguousText = await screen.findByText(/ambiguous:/)
    const params = JSON.parse(ambiguousText.props.children.join('').replace('ambiguous: ', ''))
    expect(params.species).toEqual([
      { scientificName: 'Monarda didyma', commonName: 'bee balm' },
      { scientificName: 'Monarda fistulosa', commonName: 'bee balm' },
    ])
    expect(params.photoIds).toEqual(defaultPhotoIds)
  })

  it('picking a species on the ambiguous screen updates this same Review instance, not a stale one', async () => {
    // Regression test: React Navigation reuses the already-mounted TagScanReview
    // instance when navigated back to (it does not push a new one), so the
    // fields must re-sync from updated route.params rather than only from the
    // initial mount value. Uses the real TagScanAmbiguousSpeciesScreen (not a
    // stub) so the round trip is exercised for real.
    const fake = createFakes()
    fake.functionsInvoke.mockResolvedValueOnce({
      data: {
        species: [
          { scientificName: 'Monarda didyma', commonName: 'bee balm' },
          { scientificName: 'Monarda fistulosa', commonName: 'bee balm' },
        ],
      },
      error: null,
    })
    await render(
      <Providers fake={fake}>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen
              name="TagScanReview"
              component={TagScanReviewScreen}
              initialParams={{ scanId: 'scan-1', photoIds: defaultPhotoIds }}
            />
            <Stack.Screen name="TagScanAmbiguousSpecies" component={TagScanAmbiguousSpeciesScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </Providers>,
    )
    await waitFor(() => expect(screen.getByLabelText('Common name')).toBeTruthy())
    await fireEvent.changeText(screen.getByLabelText('Common name'), 'bee balm')
    await fireEvent.press(screen.getByRole('button', { name: 'Look up species' }))
    await screen.findByText('Which one is this?')

    await fireEvent.press(screen.getByText('Monarda fistulosa'))

    expect(await screen.findByLabelText('Scientific name')).toBeTruthy()
    expect(screen.getByLabelText('Scientific name').props.value).toBe('Monarda fistulosa')
    expect(screen.getByLabelText('Common name').props.value).toBe('bee balm')
  })

  it('offers a new Planting against an existing matching Plant instead of creating a duplicate', async () => {
    const fake = await renderReviewFlow(
      createFakes([
        plantRow({ id: 'plant-1', common_name: 'Bee balm', scientific_name: 'Monarda didyma' }),
      ]),
    )
    await waitFor(() => expect(screen.getByLabelText('Common name')).toBeTruthy())
    await waitUntilPlantsLoaded()

    await fireEvent.changeText(screen.getByLabelText('Common name'), 'Bee balm')
    await fireEvent.changeText(screen.getByLabelText('Scientific name'), 'Monarda didyma')
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }))

    const duplicateText = await screen.findByText(/duplicate:/)
    const params = JSON.parse(duplicateText.props.children.join('').replace('duplicate: ', ''))
    expect(params.existingPlant).toMatchObject({ id: 'plant-1', scientificName: 'Monarda didyma' })
    expect(params.photoIds).toEqual(defaultPhotoIds)
    expect(fake.plantRows()).toHaveLength(1) // no new Plant row was created
  })

  it('disables Continue until the existing-Plants check has finished loading, closing the duplicate-detection race', async () => {
    const fake = createFakes([
      plantRow({ id: 'plant-1', common_name: 'Bee balm', scientific_name: 'Monarda didyma' }),
    ])
    let resolveListPlants!: (value: { data: unknown; error: null }) => void
    const pending = new Promise((resolve) => {
      resolveListPlants = resolve
    })
    const originalFrom = fake.client.from.bind(fake.client)
    jest.spyOn(fake.client, 'from').mockImplementation(((table: any) => {
      if (table !== 'plants') return originalFrom(table)
      return { select: () => ({ order: () => pending }) }
    }) as typeof fake.client.from)
    await renderReviewFlow(fake)
    await waitFor(() => expect(screen.getByLabelText('Common name')).toBeTruthy())

    expect(screen.getByRole('button', { name: 'Continue' }).props.accessibilityState.disabled).toBe(true)

    resolveListPlants({ data: fake.plantRows(), error: null })
    await waitUntilPlantsLoaded()

    expect(screen.getByRole('button', { name: 'Continue' }).props.accessibilityState.disabled).toBe(false)
  })

  it('blocks a garbled/bad OCR candidate from being applied without confirmation', async () => {
    await renderReviewFlow(createFakes(), {
      scanId: 'scan-1',
      photoIds: defaultPhotoIds,
      candidate: { commonName: '###garbled###', scientificName: '' },
    })
    await waitFor(() => expect(screen.getByLabelText('Common name')).toBeTruthy())
    await waitUntilPlantsLoaded()

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Scientific name is required.')).toBeTruthy()
    expect(screen.queryByText('dashboard screen')).toBeNull()
  })

  it('creates the Plant and links both tag photos when there is no duplicate and no USDA match', async () => {
    const fake = await renderReviewFlow(
      createFakes([], [tagPhotoRow('tag-photo-1'), tagPhotoRow('tag-photo-2')]),
      { scanId: 'scan-1', photoIds: { frontTagPhotoId: 'tag-photo-1', backTagPhotoId: 'tag-photo-2' } },
    )
    fake.functionsInvoke.mockResolvedValueOnce({ data: { species: [] }, error: null })
    await waitFor(() => expect(screen.getByLabelText('Common name')).toBeTruthy())
    await waitUntilPlantsLoaded()

    await fireEvent.changeText(screen.getByLabelText('Common name'), 'Bee balm')
    await fireEvent.changeText(screen.getByLabelText('Scientific name'), 'Monarda didyma')
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('dashboard screen')).toBeTruthy()
    expect(fake.plantRows()).toEqual([
      expect.objectContaining({ common_name: 'Bee balm', scientific_name: 'Monarda didyma' }),
    ])
    const plantId = fake.plantRows()[0].id
    expect(fake.tagPhotoRows()).toEqual([
      expect.objectContaining({ id: 'tag-photo-1', plant_id: plantId }),
      expect.objectContaining({ id: 'tag-photo-2', plant_id: plantId }),
    ])
  })

  it('still lands on Dashboard with the Plant saved even if linking the tag photo fails afterward', async () => {
    const fake = await renderReviewFlow(
      createFakes([], [tagPhotoRow('tag-photo-1')]),
      { scanId: 'scan-1', photoIds: defaultPhotoIds },
    )
    fake.functionsInvoke.mockResolvedValueOnce({ data: { species: [] }, error: null })
    const originalFrom = fake.client.from.bind(fake.client)
    jest.spyOn(fake.client, 'from').mockImplementation(((table: any) => {
      const real = originalFrom(table)
      if (table !== 'tag_photos') return real
      return {
        ...real,
        update: () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'network error' } }) }),
      }
    }) as typeof fake.client.from)
    await waitFor(() => expect(screen.getByLabelText('Common name')).toBeTruthy())
    await waitUntilPlantsLoaded()

    await fireEvent.changeText(screen.getByLabelText('Common name'), 'Bee balm')
    await fireEvent.changeText(screen.getByLabelText('Scientific name'), 'Monarda didyma')
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }))

    // The Plant was still saved — the link failure must not surface as "could not save this Plant",
    // since that would invite a resubmit that creates a second, duplicate Plant.
    expect(await screen.findByText('dashboard screen')).toBeTruthy()
    expect(fake.plantRows()).toHaveLength(1)
  })

  it('shows suggested USDA traits before creating; hardiness zone is shown as reference-only and never silently applied', async () => {
    const fake = await renderReviewFlow(
      createFakes([], [tagPhotoRow('tag-photo-1')]),
      { scanId: 'scan-1', photoIds: defaultPhotoIds },
    )
    fake.functionsInvoke.mockResolvedValueOnce({
      data: {
        species: [{ scientificName: 'Digitalis purpurea', commonName: 'purple foxglove' }],
        characteristics: [
          { name: 'Shade Tolerance', value: 'High' },
          { name: 'Height, Mature (feet)', value: '5.0' },
          { name: 'Temperature, Minimum (°F)', value: '-13' },
        ],
      },
      error: null,
    })
    await waitFor(() => expect(screen.getByLabelText('Common name')).toBeTruthy())
    await waitUntilPlantsLoaded()

    await fireEvent.changeText(screen.getByLabelText('Common name'), 'purple foxglove')
    await fireEvent.changeText(screen.getByLabelText('Scientific name'), 'Digitalis purpurea')
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Suggested traits')).toBeTruthy()
    // Displayed via formatOption, the same treatment the Registry gives this
    // enum — the stored value is still the raw 'full-shade' (asserted below).
    expect(screen.getByText('Sun/shade: full shade')).toBeTruthy()
    expect(screen.getByText(/For reference only, not saved automatically/)).toBeTruthy()

    await fireEvent.press(screen.getByRole('button', { name: 'Use these suggested traits' }))

    expect(await screen.findByText('dashboard screen')).toBeTruthy()
    expect(fake.plantRows()[0]).toMatchObject({ sun_requirement: 'full-shade', mature_height_inches: 60 })
    expect(fake.plantRows()[0].hardiness_zone_min).toBeNull() // never fabricated from a min-only USDA value
  })
})
