import type { BedRow, PlantRow, PlantingRow, PropertyRow } from '@plant-app/domain'
import { STAGE_SIZE_PX } from '@plant-app/domain'
import { NavigationContainer, useRoute, type RouteProp } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Alert, Text } from 'react-native'
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

const BEE_BALM: PlantRow = plantRow({
  id: 'plant-beebalm',
  common_name: 'Bee Balm',
  scientific_name: 'Monarda didyma',
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
                <Stack.Screen name="BaseMapSetup" component={BaseMapSetupStub} />
              </Stack.Navigator>
            </NavigationContainer>
          </PlantsRepositoryProvider>
        </PlantingsRepositoryProvider>
      </BedsRepositoryProvider>
    </PropertiesRepositoryProvider>,
  )
  return { ...view, plantings }
}

/** Stands in for the real base-map setup screen (#15), so the Map's empty states can be asserted to route somewhere without pulling that screen's own loading and photo picker in. */
function BaseMapSetupStub() {
  return <Text>Base map setup</Text>
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

  it('offers to set a base map up here when the account has no Property yet (#15)', async () => {
    await renderScreen({ property: null })

    expect(await screen.findByText(/don’t have a Property yet/)).toBeTruthy()
    await fireEvent.press(screen.getByText('Photograph a plot plan'))

    expect(await screen.findByText('Base map setup')).toBeTruthy()
  })

  // An aerial Property whose address had no imagery coverage is the only way
  // a Property can really reach this state: migration 0017's
  // `properties_base_map_source_consistent` forbids a photo/drawn row whose
  // scale_reference is null.
  it('offers to calibrate here when an aerial Property has no imagery to scale from (#15)', async () => {
    await renderScreen({
      property: propertyRow({
        base_map_source: 'aerial',
        imagery_zoom: null,
        imagery_available: false,
        scale_reference: null,
      }),
    })

    expect(await screen.findByText(/no map scale yet/)).toBeTruthy()
    await fireEvent.press(screen.getByText('Set up its base map'))

    expect(await screen.findByText('Base map setup')).toBeTruthy()
  })

  it('deletes the Property after confirming, so one created on the phone can be undone there (#15)', async () => {
    const properties = createFakePropertiesDbClient(propertyRow({ id: 'property-1' }))
    jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        const confirm = buttons?.find((button) => button.style === 'destructive')
        void confirm?.onPress?.()
      })

    await renderScreen({ propertiesClient: properties.client })
    await screen.findByTestId('map-overlay')
    await fireEvent.press(screen.getByText('Delete Property'))

    await waitFor(() => expect(properties.row()).toBeNull())
    expect(Alert.alert).toHaveBeenCalled()
  })

  it('can delete an uncalibrated Property too, which is otherwise a dead end on the phone', async () => {
    const properties = createFakePropertiesDbClient(
      propertyRow({ id: 'property-1', base_map_source: 'aerial', imagery_zoom: null, scale_reference: null }),
    )
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      void buttons?.find((button) => button.style === 'destructive')?.onPress?.()
    })

    await renderScreen({ propertiesClient: properties.client })
    await screen.findByText(/no map scale yet/)
    await fireEvent.press(screen.getByText('Delete Property'))

    await waitFor(() => expect(properties.row()).toBeNull())
  })

  it('keeps the Property when the delete confirmation is dismissed', async () => {
    const properties = createFakePropertiesDbClient(propertyRow({ id: 'property-1' }))
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const cancel = buttons?.find((button) => button.style === 'cancel')
      void cancel?.onPress?.()
    })

    await renderScreen({ propertiesClient: properties.client })
    await screen.findByTestId('map-overlay')
    await fireEvent.press(screen.getByText('Delete Property'))

    expect(properties.row()).not.toBeNull()
  })

  it('does not offer the photo route for a drawn base map, which setting one up would discard', async () => {
    await renderScreen({
      property: propertyRow({ base_map_source: 'drawn', base_map_drawing: [], scale_reference: null }),
    })

    expect(await screen.findByText(/no map scale yet/)).toBeTruthy()
    expect(screen.queryByText('Set up its base map')).toBeNull()
    expect(screen.getByText('Finish setting this one up on the desktop app.')).toBeTruthy()
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

  /** 21ft/30ft against PLANTED's 20ft/30ft — 2 surface pixels apart at this Property's 2px/ft, well inside one fingertip. */
  const PLANTED_BESIDE_IT: PlantingRow = plantingRow({
    id: 'planting-2',
    plant_id: 'plant-beebalm',
    bed_id: 'bed-front',
    quantity: 1,
    pin_x: 21,
    pin_y: 30,
  })

  it('offers the choice when a tap lands on more than one Pin, instead of picking by draw order', async () => {
    await renderScreen({
      plantRows: [CONEFLOWER, BEE_BALM],
      plantingRows: [PLANTED, PLANTED_BESIDE_IT],
    })

    await fireEvent.press(await screen.findByTestId('map-pin-planting-1'))

    expect(await screen.findByText('2 Plantings here')).toBeTruthy()

    // Reaching the *other* Planting from a tap that landed on its neighbour is
    // the whole point — draw order alone could never get here.
    await fireEvent.press(screen.getByTestId('cluster-choice-planting-2'))

    expect(await screen.findByText('Planting detail for planting-2')).toBeTruthy()
  })

  // The sheet covers the lower screen, so without this the gardener is told
  // "2 Plantings here" with no way to see where "here" is.
  it('rings the Pins on the map while the chooser is open, and stops when it closes', async () => {
    await renderScreen({
      plantRows: [CONEFLOWER, BEE_BALM],
      plantingRows: [PLANTED, PLANTED_BESIDE_IT],
    })

    expect(screen.queryByTestId('cluster-highlight')).toBeNull()

    await fireEvent.press(await screen.findByTestId('map-pin-planting-1'))

    expect(await screen.findByTestId('cluster-highlight')).toBeTruthy()

    await fireEvent.press(screen.getByText('Cancel'))

    expect(screen.queryByTestId('cluster-highlight')).toBeNull()
  })

  /** Same Plant, same quantity, same spot, differing only in when they were added. */
  function addedAt(id: string, pinX: number, time: string): PlantingRow {
    return plantingRow({
      id,
      plant_id: 'plant-coneflower',
      bed_id: 'bed-front',
      quantity: 1,
      pin_x: pinX,
      pin_y: 30,
      created_at: `2026-03-12T${time}:00.000Z`,
    })
  }

  // The gardener's actual case: a group of the same Plant put in during one
  // sitting, so name, quantity, year, nursery *and* date are all shared. The
  // time is the only thing left, and position can't help — these Pins are in
  // the chooser precisely because they overlap.
  it('separates Plantings of the same Plant added on the same day', async () => {
    await renderScreen({
      plantingRows: [
        addedAt('planting-a', 20, '09:14'),
        addedAt('planting-b', 21, '09:21'),
        addedAt('planting-c', 22, '09:26'),
      ],
    })

    await fireEvent.press(await screen.findByTestId('map-pin-planting-a'))

    expect(await screen.findByText('3 Plantings here')).toBeTruthy()
    // Asserted as "every row reads differently" rather than against literal
    // times, which would pin this test to whatever timezone it runs in.
    const details = screen.getAllByText(/^added /)
    const rendered = details.map((node) => node.props.children)
    expect(details).toHaveLength(3)
    expect(new Set(rendered).size).toBe(3)
  })

  it('leads with the year and nursery when a Planting has them', async () => {
    const FROM_A_NURSERY: PlantingRow = plantingRow({
      ...addedAt('planting-a', 20, '09:14'),
      year_acquired: 2024,
      source_nursery: 'Prairie Moon',
    })
    await renderScreen({ plantingRows: [FROM_A_NURSERY, addedAt('planting-b', 21, '09:21')] })

    await fireEvent.press(await screen.findByTestId('map-pin-planting-a'))

    expect(
      await screen.findByText('acquired 2024 · Prairie Moon · added', { exact: false }),
    ).toBeTruthy()
  })

  it('opens straight through when the nearest other Pin is far enough to tell apart', async () => {
    const FAR_OFF: PlantingRow = plantingRow({
      id: 'planting-3',
      plant_id: 'plant-beebalm',
      bed_id: 'bed-front',
      pin_x: 55,
      pin_y: 55,
    })
    await renderScreen({ plantRows: [CONEFLOWER, BEE_BALM], plantingRows: [PLANTED, FAR_OFF] })

    await fireEvent.press(await screen.findByTestId('map-pin-planting-1'))

    expect(await screen.findByText('Planting detail for planting-1')).toBeTruthy()
  })
})

describe('MapScreen — placing a Pin', () => {
  it('waits for the Pin to be dragged onto a Bed before it can be saved', async () => {
    await renderScreen()
    await fireEvent.press(await screen.findByText('Add Planting'))

    // The marker starts at the middle of the map, which is bare ground here.
    // Matched loosely: the same line also carries the Plant requirement (see
    // the test below), which is a separate concern from this one.
    expect(
      await screen.findByText('Drag the pin onto a Bed to place this Planting.', { exact: false }),
    ).toBeTruthy()
    expect(screen.getByText('Save Planting').parent?.props.accessibilityState?.disabled).toBe(true)
  })

  // A fingertip covers the marker completely while dragging it (#14's device
  // QA), so the crosshair's arms are the only thing left saying where the Pin
  // actually is. It exists only during the drag — a permanent one would just
  // be clutter over the map.
  it('draws a crosshair through the marker only while it is being dragged', async () => {
    await renderScreen()
    await fireEvent.press(await screen.findByText('Add Planting'))

    expect(screen.queryByTestId('pin-crosshair')).toBeNull()

    const marker = await screen.findByTestId('new-pin')
    const held = { x: 200, y: 200 }
    const moved = { x: 220, y: 220 }
    await fireEvent(marker, 'responderGrant', touchEvent(held, held, 1000, 1000))
    await fireEvent(marker, 'responderMove', touchEvent(moved, held, 1100, 1000))

    expect(screen.getByTestId('pin-crosshair')).toBeTruthy()

    await fireEvent(marker, 'responderRelease', touchEvent(moved, moved, 1100, 1100, false))

    expect(screen.queryByTestId('pin-crosshair')).toBeNull()
  })

  it('resolves the Bed from wherever the Pin was dragged, with no Bed ever picked by hand', async () => {
    await renderScreen()
    await fireEvent.press(await screen.findByText('Add Planting'))

    await dragPinTo({ x: 70, y: 70 })

    expect(await screen.findByText('Pin is in Front border.', { exact: false })).toBeTruthy()
  })

  // Save is disabled on two conditions, and #14's device QA found only one of
  // them was ever explained: a placed Pin with no Plant chosen left an
  // encouraging "Pin is in X." above a dead grey button.
  it('says a Plant is still needed while the Pin is placed but none is chosen', async () => {
    await renderScreen()
    await fireEvent.press(await screen.findByText('Add Planting'))

    await dragPinTo({ x: 70, y: 70 })

    expect(await screen.findByText('Choose a Plant to save.', { exact: false })).toBeTruthy()
    expect(screen.getByText('Save Planting').parent?.props.accessibilityState?.disabled).toBe(true)

    await fireEvent.press(await screen.findByText('Coneflower'))

    expect(screen.queryByText('Choose a Plant to save.', { exact: false })).toBeNull()
    expect(screen.getByText('Save Planting').parent?.props.accessibilityState?.disabled).toBe(false)
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
