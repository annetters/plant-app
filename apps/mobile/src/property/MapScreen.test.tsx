import type { BedRow, PlantRow, PlantingRow, PropertyRow } from '@plant-app/domain'
import { STAGE_SIZE_PX } from '@plant-app/domain'
import { NavigationContainer, useRoute, type RouteProp } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'
import type { MainStackParamList } from '../navigation/types'
import { PlantsRepositoryProvider } from '../plants/PlantsRepositoryContext'
import { PlantingsRepositoryProvider } from '../plantings/PlantingsRepositoryContext'
import { bedRow } from '../test/bedRowFixture'
import { createFakeBedsDbClient } from '../test/fakeBedsDbClient'
import { createFakePlantingsDbClient } from '../test/fakePlantingsDbClient'
import { createFakePlantsDbClient } from '../test/fakePlantsDbClient'
import { createFakePropertiesDbClient } from '../test/fakePropertiesDbClient'
import { plantRow } from '../test/plantRowFixture'
import { plantingRow } from '../test/plantingRowFixture'
import { propertyRow } from '../test/propertyRowFixture'
import type { BedsDbClient } from './bedsRepository'
import { BedsRepositoryProvider } from './BedsRepositoryContext'
import { MapScreen } from './MapScreen'
import type { PropertiesDbClient } from './propertiesRepository'
import { PropertiesRepositoryProvider } from './PropertiesRepositoryContext'

const Stack = createNativeStackNavigator()

/**
 * A Property whose scale comes from a Scale Reference of exactly 2 pixels per
 * foot (100px of base map = 50 real feet), so every expected coordinate in
 * this file is a plain doubling rather than a derived aerial-imagery figure.
 */
const SCALED_PROPERTY: PropertyRow = propertyRow({
  id: 'property-1',
  base_map_source: 'drawn',
  base_map_drawing: [],
  latitude: null,
  longitude: null,
  imagery_zoom: null,
  scale_reference: {
    pointA: { x: 0, y: 0 },
    pointB: { x: 100, y: 0 },
    realDistanceFeet: 50,
    mode: 'known-measurement',
  },
})

/** 10ft–60ft square, i.e. stage pixels 20–120 at this Property's 2px/ft. */
const FRONT_BORDER: BedRow = bedRow({
  id: 'bed-front',
  property_id: 'property-1',
  name: 'Front border',
  tool: 'rectangle',
  smoothing_enabled: false,
  points: [
    { x: 10, y: 10 },
    { x: 60, y: 10 },
    { x: 60, y: 60 },
    { x: 10, y: 60 },
  ],
})

const CONEFLOWER: PlantRow = plantRow({
  id: 'plant-coneflower',
  common_name: 'Coneflower',
  scientific_name: 'Echinacea purpurea',
})

/** A `PropertiesDbClient` whose every query rejects — none of the fakes support a failure path. Mirrors BloomTimelineScreen.test's own. */
function createFailingPropertiesDbClient(): PropertiesDbClient {
  const failingChain = {
    select: () => failingChain,
    maybeSingle: () => failingChain,
    then: (onfulfilled: (value: { data: null; error: { message: string } }) => unknown) =>
      Promise.resolve(onfulfilled({ data: null, error: { message: 'boom' } })),
  }
  return { from: () => failingChain } as unknown as PropertiesDbClient
}

/** A `BedsDbClient` whose every query rejects, once a Property has already resolved. */
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

async function renderScreen({
  property = SCALED_PROPERTY as PropertyRow | null,
  bedRows = [FRONT_BORDER],
  plantRows = [CONEFLOWER],
  plantingRows = [] as PlantingRow[],
  propertiesClient = createFakePropertiesDbClient(property).client,
  bedsClient = createFakeBedsDbClient(bedRows).client,
}: {
  property?: PropertyRow | null
  bedRows?: BedRow[]
  plantRows?: PlantRow[]
  plantingRows?: PlantingRow[]
  propertiesClient?: PropertiesDbClient
  bedsClient?: BedsDbClient
} = {}) {
  const { client: plantsClient } = createFakePlantsDbClient(plantRows)
  const plantings = createFakePlantingsDbClient(plantingRows)

  const view = await render(
    <PropertiesRepositoryProvider client={propertiesClient}>
      <BedsRepositoryProvider client={bedsClient}>
        <PlantingsRepositoryProvider client={plantings.client}>
          <PlantsRepositoryProvider client={plantsClient}>
            <NavigationContainer>
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Map" component={MapScreen} />
                <Stack.Screen name="PlantingDetail" component={PlantingDetailStub} />
              </Stack.Navigator>
            </NavigationContainer>
          </PlantsRepositoryProvider>
        </PlantingsRepositoryProvider>
      </BedsRepositoryProvider>
    </PropertiesRepositoryProvider>,
  )
  return { ...view, plantings }
}

/** Stands in for the real Planting detail screen (#18), so "tap a Pin to view its Planting" can be asserted without pulling that whole screen's own data loading in. */
function PlantingDetailStub() {
  const route = useRoute<RouteProp<MainStackParamList, 'PlantingDetail'>>()
  return <Text>Planting detail for {route.params.plantingId}</Text>
}

/**
 * How much the map is shrunk to fit this test environment's screen — read
 * off the rendered surface rather than assumed, so these tests don't break
 * on a different default window size.
 */
function displayScaleOf(): number {
  return Number(screen.getByTestId('map-overlay').props.width) / STAGE_SIZE_PX
}

/**
 * Drags the new-Planting marker to a point on the map, in the map's own
 * pixels — building the touch history `PanResponder` derives its gesture
 * from, since it reads movement out of that rather than off the raw event.
 */
async function dragPinTo(target: { x: number; y: number }) {
  const marker = await screen.findByTestId('new-pin')
  const scale = displayScaleOf()
  const from = { x: 200, y: 200 }
  const to = {
    x: from.x + (target.x - STAGE_SIZE_PX / 2) * scale,
    y: from.y + (target.y - STAGE_SIZE_PX / 2) * scale,
  }

  await fireEvent(marker, 'responderGrant', touchEvent(from, from, 1000, 1000))
  await fireEvent(marker, 'responderMove', touchEvent(to, from, 1100, 1000))
  await fireEvent(marker, 'responderRelease', touchEvent(to, to, 1100, 1100, false))
}

function touchEvent(
  current: { x: number; y: number },
  previous: { x: number; y: number },
  currentTimeStamp: number,
  previousTimeStamp: number,
  active = true,
) {
  return {
    nativeEvent: { touches: [], changedTouches: [], identifier: 0, timestamp: currentTimeStamp },
    touchHistory: {
      touchBank: [
        {
          touchActive: active,
          startPageX: previous.x,
          startPageY: previous.y,
          startTimeStamp: previousTimeStamp,
          currentPageX: current.x,
          currentPageY: current.y,
          currentTimeStamp,
          previousPageX: previous.x,
          previousPageY: previous.y,
          previousTimeStamp,
        },
      ],
      numberActiveTouches: active ? 1 : 0,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: currentTimeStamp,
    },
  }
}

describe('MapScreen — viewing the Property', () => {
  it("draws each Bed's outline in the base map's own pixels", async () => {
    await renderScreen()

    // 10–60 feet at 2 pixels per foot. (`Polygon` renders as a closed path.)
    expect((await screen.findByTestId('bed-outline-bed-front')).props.d).toBe(
      'M20 20 120 20 120 120 20 120z',
    )
  })

  it('shows the aerial tile grid for a Property mapped from imagery', async () => {
    await renderScreen({ property: propertyRow({ id: 'property-1' }) })

    expect(await screen.findByTestId('base-map-aerial')).toBeTruthy()
  })

  it('shows the hand-drawn plan for a Property mapped from a drawing', async () => {
    await renderScreen()

    expect(await screen.findByTestId('base-map-drawn')).toBeTruthy()
  })

  it('says where to go when the account has no Property yet', async () => {
    await renderScreen({ property: null })

    expect(await screen.findByText(/don’t have a Property yet/)).toBeTruthy()
  })

  it('says where to go when the Property has no scale to draw against yet', async () => {
    await renderScreen({
      property: propertyRow({ base_map_source: 'drawn', base_map_drawing: [], scale_reference: null }),
    })

    expect(await screen.findByText(/no map scale yet/)).toBeTruthy()
  })

  it('still draws the map when only the Beds fail to load, rather than claiming there is no Property', async () => {
    await renderScreen({ bedsClient: createFailingBedsDbClient() })

    expect(await screen.findByText('Could not load this Property’s Beds.')).toBeTruthy()
    // The base map and its scale loaded fine — the map is still there.
    expect(screen.getByTestId('map-overlay')).toBeTruthy()
    expect(screen.queryByText(/don’t have a Property yet/)).toBeNull()
  })

  it('reports a Property that could not be loaded as a failure, not as one that does not exist', async () => {
    await renderScreen({ propertiesClient: createFailingPropertiesDbClient() })

    expect(await screen.findByText('Could not load your Property. Please try again.')).toBeTruthy()
    expect(screen.queryByText(/don’t have a Property yet/)).toBeNull()
  })

  it('points at the desktop app when no Bed has been drawn yet', async () => {
    await renderScreen({ bedRows: [] })

    expect(await screen.findByText(/Beds are drawn on the desktop app/)).toBeTruthy()
  })

  // Only *drawing* is desktop-only (ADR-0001, ADR-0003's parity exception).
  // Base-map upload and Scale Reference calibration are due full phone parity
  // under #15, so this deliberately doesn't assert those are absent.
  it('offers no way to draw a Bed — freehand/shape drawing stays desktop-only', async () => {
    await renderScreen()
    await screen.findByTestId('bed-outline-bed-front')

    for (const drawingTool of [/freehand/i, /rectangle/i, /oval/i, /smoothing/i, /add bed/i, /draw a bed/i, /new bed/i]) {
      expect(screen.queryByText(drawingTool)).toBeNull()
    }
  })
})

describe('MapScreen — viewing a Planting', () => {
  const PLANTED: PlantingRow = plantingRow({
    id: 'planting-1',
    plant_id: 'plant-coneflower',
    bed_id: 'bed-front',
    quantity: 3,
    pin_x: 20,
    pin_y: 30,
  })

  it("draws a Pin at each Planting's own location", async () => {
    await renderScreen({ plantingRows: [PLANTED] })

    const pin = await screen.findByTestId('map-pin-planting-1')
    expect(pin.props.cx).toBe(40)
    expect(pin.props.cy).toBe(60)
  })

  it('opens the Planting when its Pin is tapped', async () => {
    await renderScreen({ plantingRows: [PLANTED] })

    await fireEvent.press(await screen.findByTestId('map-pin-planting-1'))

    expect(await screen.findByText('Planting detail for planting-1')).toBeTruthy()
  })

  it('lists the same Plantings as tappable rows, for reaching one without hitting a dot', async () => {
    await renderScreen({ plantingRows: [PLANTED] })

    await fireEvent.press(await screen.findByText('Coneflower ×3 in Front border'))

    expect(await screen.findByText('Planting detail for planting-1')).toBeTruthy()
  })
})

describe('MapScreen — placing a Pin', () => {
  it('waits for the Pin to be dragged onto a Bed before it can be saved', async () => {
    await renderScreen()
    await fireEvent.press(await screen.findByText('Add Planting'))

    // The marker starts at the middle of the map, which is bare ground here.
    expect(await screen.findByText('Drag the pin onto a Bed to place this Planting.')).toBeTruthy()
    expect(screen.getByText('Save Planting').parent?.props.accessibilityState?.disabled).toBe(true)
  })

  it('resolves the Bed from wherever the Pin was dragged, with no Bed ever picked by hand', async () => {
    await renderScreen()
    await fireEvent.press(await screen.findByText('Add Planting'))

    await dragPinTo({ x: 70, y: 70 })

    expect(await screen.findByText('Pin is in Front border.')).toBeTruthy()
  })

  it('saves the dragged Pin as the new Planting’s Bed and real-world location', async () => {
    const { plantings } = await renderScreen()
    await fireEvent.press(await screen.findByText('Add Planting'))

    await dragPinTo({ x: 70, y: 70 })
    await fireEvent.press(await screen.findByText('Coneflower'))
    await fireEvent.changeText(screen.getByLabelText('Quantity'), '3')
    await fireEvent.changeText(screen.getByLabelText('Year acquired'), '2025')
    await fireEvent.changeText(screen.getByLabelText('Source / nursery'), 'Prairie Moon')
    await fireEvent.press(screen.getByText('Save Planting'))

    await waitFor(() => expect(plantings.plantingRows()).toHaveLength(1))
    // 70 stage pixels at 2px/ft is 35 feet — the Pin's stored real-world
    // location, never the pixels it happened to be dragged to.
    expect(plantings.plantingRows()[0]).toMatchObject({
      plant_id: 'plant-coneflower',
      bed_id: 'bed-front',
      quantity: 3,
      pin_x: 35,
      pin_y: 35,
      year_acquired: 2025,
      source_nursery: 'Prairie Moon',
    })
  })

  it('shows the new Planting on the map straight after saving, without a reload', async () => {
    await renderScreen()
    await fireEvent.press(await screen.findByText('Add Planting'))

    await dragPinTo({ x: 70, y: 70 })
    await fireEvent.press(await screen.findByText('Coneflower'))
    await fireEvent.press(screen.getByText('Save Planting'))

    expect(await screen.findByTestId('map-pin-planting-1')).toBeTruthy()
  })

  it('rejects a quantity that is not a whole number of specimens', async () => {
    const { plantings } = await renderScreen()
    await fireEvent.press(await screen.findByText('Add Planting'))

    await dragPinTo({ x: 70, y: 70 })
    await fireEvent.press(await screen.findByText('Coneflower'))
    await fireEvent.changeText(screen.getByLabelText('Quantity'), '0')
    await fireEvent.press(screen.getByText('Save Planting'))

    expect(await screen.findByText('Quantity must be a whole number of at least 1.')).toBeTruthy()
    // Next to the Save button, which may be a scroll away from the field.
    expect(screen.getByText('Check the highlighted fields above.')).toBeTruthy()
    expect(plantings.plantingRows()).toHaveLength(0)
  })

  it('cannot start a Planting with nothing in the Registry to plant', async () => {
    await renderScreen({ plantRows: [] })

    await screen.findByText(/Add a Plant to the Registry/)
    expect(screen.getByText('Add Planting').parent?.props.accessibilityState?.disabled).toBe(true)
  })
})
