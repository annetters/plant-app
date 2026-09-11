import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { parseOcrTextLines, type PlantRow } from '@plant-app/domain'
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
 * so the manual Plant form could share it), so it needs both fakes. Since
 * #36 the lookup takes two routes: `speciesRpc` resolves names against the
 * local index, `functionsInvoke` fetches live traits.
 */
function createFakes(
  initialPlantRows: PlantRow[] = [],
  initialTagPhotoRows: Record<string, unknown>[] = [],
) {
  const tagScan = createFakeTagScanDbClient(initialPlantRows, initialTagPhotoRows)
  const species = createFakeSpeciesLookupDbClient()
  return {
    ...tagScan,
    speciesClient: species.client,
    functionsInvoke: species.functionsInvoke,
    speciesRpc: species.rpc,
  }
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
          <Stack.Screen name="Map">
            {({ route }: any) => <Text>map: {JSON.stringify(route.params)}</Text>}
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

  it('pre-fills Cultivar alone from a tag that printed no scientific name, leaving the rest blank and editable (#38)', async () => {
    // Drives the REAL parser rather than a hand-made candidate, so this covers
    // the whole chain the ticket is about: OCR lines the device actually
    // produced -> parseOcrTextLines -> this screen's three fields. The line is
    // verbatim from #22's first on-device Vision run (the tag's typographic
    // quotes read as an inverted exclamation mark and a bullet).
    const [candidate] = parseOcrTextLines([{ text: '¡BLUE FORTUNE•', confidence: 1 }])
    expect(candidate).toEqual({ cultivar: 'BLUE FORTUNE' })

    await renderReviewFlow(createFakes(), { scanId: 'scan-1', photoIds: defaultPhotoIds, candidate })
    await waitFor(() => expect(screen.getByLabelText('Common name')).toBeTruthy())

    expect(screen.getByLabelText('Cultivar').props.value).toBe('BLUE FORTUNE')
    expect(screen.getByLabelText('Common name').props.value).toBe('')
    expect(screen.getByLabelText('Scientific name').props.value).toBe('')

    // The blank fields are the user's to fill, not dead ends.
    await fireEvent.changeText(screen.getByLabelText('Common name'), 'Anise hyssop')
    await fireEvent.changeText(screen.getByLabelText('Scientific name'), 'Agastache foeniculum')
    expect(screen.getByLabelText('Common name').props.value).toBe('Anise hyssop')
    expect(screen.getByLabelText('Scientific name').props.value).toBe('Agastache foeniculum')
    expect(screen.getByLabelText('Cultivar').props.value).toBe('BLUE FORTUNE')
  })

  it('pre-fills Cultivar alone for tag7, whose cultivar used to be discarded for want of a species (#38)', async () => {
    const [candidate] = parseOcrTextLines([
      { text: 'HEUCHERA', confidence: 1 },
      { text: '"Blackout"', confidence: 1 },
      { text: '(Coral Bells)', confidence: 1 },
      { text: 'Zones: 4 - 9', confidence: 1 },
    ])

    await renderReviewFlow(createFakes(), { scanId: 'scan-1', photoIds: defaultPhotoIds, candidate })
    await waitFor(() => expect(screen.getByLabelText('Common name')).toBeTruthy())

    expect(screen.getByLabelText('Cultivar').props.value).toBe('Blackout')
    expect(screen.getByLabelText('Scientific name').props.value).toBe('')
  })

  it('surfaces an ambiguous common name as distinct species candidates instead of guessing', async () => {
    const fake = await renderReviewFlow()
    fake.speciesRpc.mockResolvedValueOnce({
      data: [
        { scientific_name: 'Monarda didyma', common_name: 'scarlet beebalm' },
        { scientific_name: 'Monarda fistulosa', common_name: 'wild bergamot' },
      ],
      error: null,
    })
    await waitFor(() => expect(screen.getByLabelText('Common name')).toBeTruthy())

    await fireEvent.changeText(screen.getByLabelText('Common name'), 'bee balm')
    await fireEvent.press(screen.getByRole('button', { name: 'Look up species' }))

    const ambiguousText = await screen.findByText(/ambiguous:/)
    const params = JSON.parse(ambiguousText.props.children.join('').replace('ambiguous: ', ''))
    expect(params.species).toEqual([
      { scientificName: 'Monarda didyma', commonName: 'scarlet beebalm' },
      { scientificName: 'Monarda fistulosa', commonName: 'wild bergamot' },
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
    fake.speciesRpc.mockResolvedValueOnce({
      data: [
        { scientific_name: 'Monarda didyma', common_name: 'scarlet beebalm' },
        { scientific_name: 'Monarda fistulosa', common_name: 'wild bergamot' },
      ],
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

  /**
   * #37 replaced this path's pushed screen with the same inline offer the
   * two typed-entry forms show — one `DuplicatePlantOffer`, one wording, and
   * one place where "create anyway" re-enters this screen's own create (tag
   * photos and all), rather than a second copy of it on another screen.
   */
  async function offerShownFor(fake: ReturnType<typeof createFakes>) {
    await waitFor(() => expect(screen.getByLabelText('Common name')).toBeTruthy())
    await waitUntilPlantsLoaded()

    await fireEvent.changeText(screen.getByLabelText('Common name'), 'Bee balm')
    await fireEvent.changeText(screen.getByLabelText('Scientific name'), 'Monarda didyma')
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('You already have this Plant')).toBeTruthy()
    return fake
  }

  const existingBeeBalm = () =>
    createFakes(
      [plantRow({ id: 'plant-1', common_name: 'Bee balm', scientific_name: 'Monarda didyma' })],
      [tagPhotoRow('tag-photo-1')],
    )

  it('offers a new Planting against an existing matching Plant instead of creating a duplicate', async () => {
    const fake = await offerShownFor(await renderReviewFlow(existingBeeBalm()))

    expect(screen.getByText('Bee balm (Monarda didyma)')).toBeTruthy()
    expect(fake.plantRows()).toHaveLength(1) // no new Plant row was created
  })

  it('sends "add a Planting" to the Map against the existing Plant, writing nothing on the way', async () => {
    const fake = await offerShownFor(await renderReviewFlow(existingBeeBalm()))

    await fireEvent.press(screen.getByRole('button', { name: 'Add a Planting against this Plant' }))

    expect(await screen.findByText(/"addPlantingForPlantId":"plant-1"/)).toBeTruthy()
    expect(fake.plantRows()).toHaveLength(1)
    // Nothing is written to the Plant the gardener came here not to duplicate
    // — least of all a tag-photo link they can't undo from the app.
    expect(fake.tagPhotoRows()).toHaveLength(1)
    expect(fake.tagPhotoRows()[0].plant_id).toBeUndefined() // never linked to it
  })

  it('goes back to the review fields, unwritten, when the user chooses to edit', async () => {
    const fake = await offerShownFor(await renderReviewFlow(existingBeeBalm()))

    await fireEvent.press(screen.getByRole('button', { name: 'Go back and edit' }))

    expect(screen.getByLabelText('Scientific name').props.value).toBe('Monarda didyma')
    expect(screen.queryByText('You already have this Plant')).toBeNull()
    expect(fake.plantRows()).toHaveLength(1)
  })

  it('creates a second Plant anyway on the user\'s say-so, linking the tag photo to it', async () => {
    const fake = existingBeeBalm()
    await renderReviewFlow(fake)
    fake.functionsInvoke.mockResolvedValueOnce({ data: { species: [] }, error: null })
    await offerShownFor(fake)

    await fireEvent.press(
      screen.getByRole('button', { name: 'This is a different Plant — create it anyway' }),
    )

    expect(await screen.findByText('dashboard screen')).toBeTruthy()
    expect(fake.plantRows()).toHaveLength(2)
    const createdId = fake.plantRows()[1].id
    expect(fake.tagPhotoRows()).toEqual([
      expect.objectContaining({ id: 'tag-photo-1', plant_id: createdId }),
    ])
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
    // USDA reports Shade Tolerance "High" for this species and it is in the
    // fixture above, but nothing is offered from it any more (#44) — the
    // reading is close to inverted, so no sun/shade line renders and none is
    // written on accept.
    expect(screen.queryByText(/Sun\/shade/)).toBeNull()
    expect(screen.getByText(/For reference only, not saved automatically/)).toBeTruthy()

    await fireEvent.press(screen.getByRole('button', { name: 'Use these suggested traits' }))

    expect(await screen.findByText('dashboard screen')).toBeTruthy()
    expect(fake.plantRows()[0]).toMatchObject({ mature_height_inches: 60 })
    expect(fake.plantRows()[0].sun_requirement).toBeNull()
    expect(fake.plantRows()[0].hardiness_zone_min).toBeNull() // never fabricated from a min-only USDA value
  })
})
