import type { BedRow, PlantRow, PlantingRow, PropertyRow } from '@plant-app/domain'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native'
import { PlantsRepositoryProvider } from '../plants/PlantsRepositoryContext'
import { PlantingsRepositoryProvider } from '../plantings/PlantingsRepositoryContext'
import type { BedsDbClient } from '../property/bedsRepository'
import { BedsRepositoryProvider } from '../property/BedsRepositoryContext'
import { PropertiesRepositoryProvider } from '../property/PropertiesRepositoryContext'
import type { PropertiesDbClient } from '../property/propertiesRepository'
import { bedRow } from '../test/bedRowFixture'
import { createFakeBedsDbClient } from '../test/fakeBedsDbClient'
import { createFakePlantingsDbClient } from '../test/fakePlantingsDbClient'
import { createFakePlantsDbClient } from '../test/fakePlantsDbClient'
import { createFakePropertiesDbClient } from '../test/fakePropertiesDbClient'
import { plantRow } from '../test/plantRowFixture'
import { plantingRow } from '../test/plantingRowFixture'
import { propertyRow } from '../test/propertyRowFixture'
import { BloomTimelineScreen } from './BloomTimelineScreen'

const Stack = createNativeStackNavigator()

/** A `PropertiesDbClient` whose every `properties` query rejects — for exercising the Property-fetch failure path, which none of the fakes support. */
function createFailingPropertiesDbClient(): PropertiesDbClient {
  const failingChain = {
    select: () => failingChain,
    maybeSingle: () => failingChain,
    then: (onfulfilled: (value: { data: null; error: { message: string } }) => unknown) =>
      Promise.resolve(onfulfilled({ data: null, error: { message: 'boom' } })),
  }
  return { from: () => failingChain } as unknown as PropertiesDbClient
}

/** A `BedsDbClient` whose every `beds` query rejects — for exercising the Beds-fetch failure path, once a Property already resolved. */
function createFailingBedsDbClient(): BedsDbClient {
  const failingChain = {
    select: () => failingChain,
    eq: () => failingChain,
    order: () => failingChain,
    then: (onfulfilled: (value: { data: null; error: { message: string } }) => unknown) =>
      Promise.resolve(onfulfilled({ data: null, error: { message: 'boom' } })),
  }
  return { from: () => failingChain } as unknown as BedsDbClient
}

const CONEFLOWER: PlantRow = plantRow({
  id: 'plant-coneflower',
  common_name: 'Coneflower',
  scientific_name: 'Echinacea purpurea',
  bloom_start_month: 6,
  bloom_start_day: 1,
  bloom_end_month: 8,
  bloom_end_day: 15,
})

const ASTER: PlantRow = plantRow({
  id: 'plant-aster',
  common_name: 'Aster',
  scientific_name: 'Symphyotrichum novae-angliae',
  bloom_start_month: 9,
  bloom_start_day: 1,
  bloom_end_month: 10,
  bloom_end_day: 1,
})

const WINTERBERRY: PlantRow = plantRow({
  id: 'plant-winterberry',
  common_name: 'Winterberry',
  scientific_name: 'Ilex verticillata',
  bloom_start_month: 11,
  bloom_start_day: 15,
  bloom_end_month: 2,
  bloom_end_day: 15,
})

const FERN_NO_BLOOM: PlantRow = plantRow({
  id: 'plant-fern',
  common_name: 'Fern',
  scientific_name: 'Polystichum acrostichoides',
})

// A wrapping window whose start/end land on adjacent day-of-year pixel
// offsets (June 1 = day 153, May 31 = day 152) — a pixel-comparison wrap
// check (`endPx < startPx`) would see equal offsets and misclassify this as
// non-wrapping; only the domain's own `bloomWindowWraps` gets it right.
const NEARLY_YEAR_LONG: PlantRow = plantRow({
  id: 'plant-nearly-year-long',
  common_name: 'Nearly year long',
  scientific_name: 'Testus perpetuus',
  bloom_start_month: 6,
  bloom_start_day: 1,
  bloom_end_month: 5,
  bloom_end_day: 31,
})

async function renderScreen({
  plantRows = [],
  bedRows = [],
  plantingRows = [],
  property = null,
}: {
  plantRows?: PlantRow[]
  bedRows?: BedRow[]
  plantingRows?: PlantingRow[]
  property?: PropertyRow | null
} = {}) {
  const { client: plantsClient } = createFakePlantsDbClient(plantRows)
  const { client: bedsClient } = createFakeBedsDbClient(bedRows)
  const { client: plantingsClient } = createFakePlantingsDbClient(plantingRows)
  const { client: propertiesClient } = createFakePropertiesDbClient(property)

  return render(
    <PropertiesRepositoryProvider client={propertiesClient}>
      <BedsRepositoryProvider client={bedsClient}>
        <PlantingsRepositoryProvider client={plantingsClient}>
          <PlantsRepositoryProvider client={plantsClient}>
            <NavigationContainer>
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="BloomTimeline" component={BloomTimelineScreen} />
              </Stack.Navigator>
            </NavigationContainer>
          </PlantsRepositoryProvider>
        </PlantingsRepositoryProvider>
      </BedsRepositoryProvider>
    </PropertiesRepositoryProvider>,
  )
}

describe('BloomTimelineScreen — year-view chart', () => {
  it('shows a bar for every Plant with a bloom window', async () => {
    await renderScreen({ plantRows: [CONEFLOWER, ASTER] })
    expect(await screen.findByText('Coneflower')).toBeTruthy()
    expect(screen.getByText('Aster')).toBeTruthy()
  })

  it('omits Plants with no bloom window set', async () => {
    await renderScreen({ plantRows: [CONEFLOWER, FERN_NO_BLOOM] })
    await screen.findByText('Coneflower')
    expect(screen.queryByText('Fern')).toBeNull()
  })

  it('shows an empty state when no Plant has a bloom window', async () => {
    await renderScreen({ plantRows: [FERN_NO_BLOOM] })
    expect(await screen.findByText(/No bloom windows to show/)).toBeTruthy()
  })
})

describe('BloomTimelineScreen — Bed filter', () => {
  it('narrows the chart to only Plants planted in the selected Bed', async () => {
    await renderScreen({
      plantRows: [CONEFLOWER, ASTER],
      property: propertyRow({ id: 'property-1' }),
      bedRows: [
        bedRow({ id: 'bed-front', property_id: 'property-1', name: 'Front border' }),
        bedRow({ id: 'bed-back', property_id: 'property-1', name: 'Back bed' }),
      ],
      plantingRows: [
        plantingRow({ id: 'planting-1', plant_id: 'plant-coneflower', bed_id: 'bed-front' }),
        plantingRow({ id: 'planting-2', plant_id: 'plant-aster', bed_id: 'bed-back' }),
      ],
    })

    await screen.findByText('Coneflower')
    expect(screen.getByText('Aster')).toBeTruthy()

    const frontBorderChip = await screen.findByRole('button', { name: 'Front border' })
    fireEvent.press(frontBorderChip)

    await waitFor(() => {
      expect(screen.queryByText('Aster')).toBeNull()
    })
    expect(screen.getByText('Coneflower')).toBeTruthy()
  })
})

describe('BloomTimelineScreen — month-filtered list', () => {
  it('lists the same underlying bars, narrowed to the selected month, including a wrapping bloom window', async () => {
    await renderScreen({ plantRows: [CONEFLOWER, ASTER, WINTERBERRY] })
    await screen.findByText('Coneflower')

    const listViewButton = screen.getByRole('button', { name: 'List view' })
    fireEvent.press(listViewButton)

    const decemberChip = await screen.findByRole('button', { name: 'December' })
    fireEvent.press(decemberChip)

    const list = await screen.findByLabelText('Blooming this month')
    expect(within(list).getByText(/Winterberry/)).toBeTruthy()
    expect(within(list).queryByText(/Coneflower/)).toBeNull()
    expect(within(list).queryByText(/Aster/)).toBeNull()
  })

  it('defaults to every blooming Plant when no month is selected', async () => {
    await renderScreen({ plantRows: [CONEFLOWER, ASTER, WINTERBERRY] })
    await screen.findByText('Coneflower')

    const listViewButton = screen.getByRole('button', { name: 'List view' })
    fireEvent.press(listViewButton)

    const list = await screen.findByLabelText('Blooming this month')
    expect(within(list).getByText(/Coneflower/)).toBeTruthy()
    expect(within(list).getByText(/Aster/)).toBeTruthy()
    expect(within(list).getByText(/Winterberry/)).toBeTruthy()
  })
})

describe('BloomTimelineScreen — Property/Beds load errors', () => {
  it('reports a Property-fetch failure distinctly from a Beds-fetch failure', async () => {
    const plants = createFakePlantsDbClient([])
    const beds = createFakeBedsDbClient([])
    const plantings = createFakePlantingsDbClient([])
    await render(
      <PropertiesRepositoryProvider client={createFailingPropertiesDbClient()}>
        <BedsRepositoryProvider client={beds.client}>
          <PlantingsRepositoryProvider client={plantings.client}>
            <PlantsRepositoryProvider client={plants.client}>
              <NavigationContainer>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="BloomTimeline" component={BloomTimelineScreen} />
                </Stack.Navigator>
              </NavigationContainer>
            </PlantsRepositoryProvider>
          </PlantingsRepositoryProvider>
        </BedsRepositoryProvider>
      </PropertiesRepositoryProvider>,
    )

    expect(await screen.findByText('Could not load your Property.')).toBeTruthy()
  })

  it("reports a Beds-fetch failure once the Property itself resolved", async () => {
    const plants = createFakePlantsDbClient([])
    const properties = createFakePropertiesDbClient(propertyRow({ id: 'property-1' }))
    const plantings = createFakePlantingsDbClient([])
    await render(
      <PropertiesRepositoryProvider client={properties.client}>
        <BedsRepositoryProvider client={createFailingBedsDbClient()}>
          <PlantingsRepositoryProvider client={plantings.client}>
            <PlantsRepositoryProvider client={plants.client}>
              <NavigationContainer>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="BloomTimeline" component={BloomTimelineScreen} />
                </Stack.Navigator>
              </NavigationContainer>
            </PlantsRepositoryProvider>
          </PlantingsRepositoryProvider>
        </BedsRepositoryProvider>
      </PropertiesRepositoryProvider>,
    )

    expect(await screen.findByText("Could not load this Property's Beds.")).toBeTruthy()
  })
})

describe('BloomTimelineScreen — month axis', () => {
  it('shows an abbreviated month label for every month in chart view', async () => {
    await renderScreen({ plantRows: [CONEFLOWER, ASTER] })
    await screen.findByText('Coneflower')

    for (const month of ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']) {
      expect(screen.getByText(month)).toBeTruthy()
    }
  })

  it('is absent in list view', async () => {
    await renderScreen({ plantRows: [CONEFLOWER, ASTER] })
    await screen.findByText('Coneflower')

    const listViewButton = screen.getByRole('button', { name: 'List view' })
    fireEvent.press(listViewButton)

    await waitFor(() => {
      expect(screen.queryByText('Jan')).toBeNull()
    })
  })

  it('is absent in the empty state (no blooming Plants)', async () => {
    await renderScreen({ plantRows: [FERN_NO_BLOOM] })
    await screen.findByText(/No bloom windows to show/)

    expect(screen.queryByText('Jan')).toBeNull()
  })
})

describe('BloomTimelineScreen — no Beds yet hint', () => {
  it('shows a hint pointing at the Map once it exists, when there are no Beds', async () => {
    await renderScreen({ plantRows: [CONEFLOWER] })
    await screen.findByText('Coneflower')

    expect(await screen.findByText(/No Beds yet/)).toBeTruthy()
  })

  it('is absent once at least one Bed exists', async () => {
    await renderScreen({
      plantRows: [CONEFLOWER],
      property: propertyRow({ id: 'property-1' }),
      bedRows: [bedRow({ id: 'bed-front', property_id: 'property-1', name: 'Front border' })],
    })
    await screen.findByText('Coneflower')

    expect(screen.queryByText(/No Beds yet/)).toBeNull()
  })
})

describe('BloomTimelineScreen — bar positioning', () => {
  it("positions a bar's track at its bloom window's day-of-year offset", async () => {
    await renderScreen({ plantRows: [CONEFLOWER] })

    const track = await screen.findByLabelText('Blooms June 1 – August 15')
    const bar = within(track).getByTestId('bloom-bar-segment')
    const style = Array.isArray(bar.props.style) ? Object.assign({}, ...bar.props.style) : bar.props.style

    // June 1 = day 153 of 366 (leap-safe table: days-before-June is 152,
    // +1 = 153); Aug 15 = day 228 (days-before-August is 213, +15 = 228).
    // left uses (dayOfYear - 1) for the start; width spans to the end's
    // un-decremented dayOfYear, matching web's BarTrack percentage math.
    expect(style.left).toBeCloseTo((152 / 366) * 1800, 0)
    expect(style.width).toBeCloseTo(((228 - 152) / 366) * 1800, 0)
  })

  it('renders a wrapping bloom window as two segments', async () => {
    await renderScreen({ plantRows: [WINTERBERRY] })

    const track = await screen.findByLabelText('Blooms November 15 – February 15')
    const segments = within(track).getAllByTestId('bloom-bar-segment')
    expect(segments).toHaveLength(2)
  })

  it('renders a wrapping window as two segments even when its start/end pixel offsets are equal', async () => {
    await renderScreen({ plantRows: [NEARLY_YEAR_LONG] })

    const track = await screen.findByLabelText('Blooms June 1 – May 31')
    const segments = within(track).getAllByTestId('bloom-bar-segment')
    expect(segments).toHaveLength(2)
  })

  it("gives every row a visible rail and month ticks, so an empty stretch of track still reads as a timeline rather than a rendering failure", async () => {
    await renderScreen({ plantRows: [CONEFLOWER] })

    const track = await screen.findByLabelText('Blooms June 1 – August 15')
    const railStyle = Array.isArray(track.props.style)
      ? Object.assign({}, ...track.props.style)
      : track.props.style
    expect(railStyle.backgroundColor).toBeTruthy()
    expect(railStyle.borderColor).toBeTruthy()

    expect(within(track).getAllByTestId('bloom-month-tick')).toHaveLength(12)
  })
})

describe('BloomTimelineScreen — Beds-fetch error', () => {
  it('does not show the "No Beds yet" hint when the Beds fetch failed rather than actually finding none', async () => {
    const plants = createFakePlantsDbClient([CONEFLOWER])
    const properties = createFakePropertiesDbClient(propertyRow({ id: 'property-1' }))
    const plantings = createFakePlantingsDbClient([])
    await render(
      <PropertiesRepositoryProvider client={properties.client}>
        <BedsRepositoryProvider client={createFailingBedsDbClient()}>
          <PlantingsRepositoryProvider client={plantings.client}>
            <PlantsRepositoryProvider client={plants.client}>
              <NavigationContainer>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="BloomTimeline" component={BloomTimelineScreen} />
                </Stack.Navigator>
              </NavigationContainer>
            </PlantsRepositoryProvider>
          </PlantingsRepositoryProvider>
        </BedsRepositoryProvider>
      </PropertiesRepositoryProvider>,
    )

    expect(await screen.findByText("Could not load this Property's Beds.")).toBeTruthy()
    expect(screen.queryByText(/No Beds yet/)).toBeNull()
  })
})
