import type { BedRow, PlantingPhotoRow, PlantingRow, PlantRow, PropertyRow } from '@plant-app/domain'
import { propertyFromRow } from '@plant-app/domain'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlantsRepositoryProvider } from '../plants/PlantsRepositoryContext'
import { BedsRepositoryProvider } from '../property/BedsRepositoryContext'
import { createFakeBedsDbClient } from '../test/fakeBedsDbClient'
import { createFakePlantingsDbClient } from '../test/fakePlantingsDbClient'
import { createFakePlantsDbClient } from '../test/fakePlantsDbClient'
import { PlantingMap } from './PlantingMap'
import { PlantingsRepositoryProvider } from './PlantingsRepositoryContext'

// jsdom has no real <canvas> 2D context — see BedEditor.test.tsx's identical
// comment. This stub is just enough surface for PlantingMap's mount/render
// effects to run without throwing; a real Konva Stage genuinely dragging a
// Pin is exercised by hand in a browser, not here.
vi.mock('konva', () => {
  class FakeNode {
    on() {}
    off() {}
    destroy() {}
  }
  class FakeContainer extends FakeNode {
    add() {}
    destroyChildren() {}
    batchDraw() {}
  }
  class FakeStage extends FakeContainer {
    getPointerPosition() {
      return null
    }
  }
  class FakeShape extends FakeNode {
    attrs: Record<string, unknown>
    constructor(attrs: Record<string, unknown> = {}) {
      super()
      this.attrs = attrs
    }
  }
  return {
    default: {
      Stage: FakeStage,
      Layer: FakeContainer,
      Line: FakeShape,
      Rect: FakeShape,
      Ellipse: FakeShape,
      Circle: FakeShape,
    },
  }
})

const AVAILABLE_ROW: PropertyRow = {
  id: 'property-1',
  address: '10 Main St, Cambridge, MA',
  resolved_address: null,
  latitude: 42.3782,
  longitude: -71.1266,
  imagery_zoom: 20,
  imagery_available: true,
  base_map_source: 'aerial',
  base_map_photo_path: null,
  base_map_drawing: null,
  scale_reference: null,
  created_at: '2026-01-01T00:00:00.000Z',
}

// Large enough to cover the canvas's default center point (where the new
// Pin marker starts, before any drag) at any realistic feet-per-pixel scale
// — lets tests exercise real Pin-resolution without simulating a Konva drag.
const BED_ROW: BedRow = {
  id: 'bed-1',
  property_id: 'property-1',
  name: 'Front border',
  tool: 'rectangle',
  points: [
    { x: 0, y: 0 },
    { x: 500, y: 0 },
    { x: 500, y: 500 },
    { x: 0, y: 500 },
  ],
  smoothing_enabled: false,
  created_at: '2026-01-01T00:00:00.000Z',
}

// Deliberately excludes the canvas's default center point, to test the
// "Drop the pin inside a Bed" path.
const FAR_BED_ROW: BedRow = {
  id: 'bed-2',
  property_id: 'property-1',
  name: 'Side bed',
  tool: 'rectangle',
  points: [
    { x: 900, y: 900 },
    { x: 910, y: 900 },
    { x: 910, y: 910 },
    { x: 900, y: 910 },
  ],
  smoothing_enabled: false,
  created_at: '2026-01-01T00:00:00.000Z',
}

const PLANT_ROW: PlantRow = {
  id: 'plant-1',
  common_name: 'Coneflower',
  scientific_name: 'Echinacea purpurea',
  cultivar: null,
  flower_color: null,
  bloom_start_month: null,
  bloom_start_day: null,
  bloom_end_month: null,
  bloom_end_day: null,
  sun_requirement: null,
  mature_height_inches: null,
  mature_spread_inches: null,
  hardiness_zone_min: null,
  hardiness_zone_max: null,
  foliage_type: null,
  native_status: null,
  reference_photo_paths: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const PLANTING_ROW: PlantingRow = {
  id: 'planting-1',
  plant_id: 'plant-1',
  bed_id: 'bed-1',
  quantity: 3,
  year_acquired: 2022,
  source_nursery: 'Weston Nurseries',
  pin_x: 2,
  pin_y: 2,
  created_at: '2026-01-01T00:00:00.000Z',
}

function renderMap({
  bedRows = [BED_ROW],
  plantRows = [PLANT_ROW],
  plantingRows = [] as PlantingRow[],
  photoRows = [] as PlantingPhotoRow[],
  selectPlantingId,
}: {
  bedRows?: BedRow[]
  plantRows?: PlantRow[]
  plantingRows?: PlantingRow[]
  photoRows?: PlantingPhotoRow[]
  selectPlantingId?: string
} = {}) {
  const property = propertyFromRow(AVAILABLE_ROW)
  const beds = createFakeBedsDbClient(bedRows)
  const plants = createFakePlantsDbClient(plantRows)
  const plantings = createFakePlantingsDbClient(plantingRows, photoRows)
  render(
    <BedsRepositoryProvider client={beds.client}>
      <PlantsRepositoryProvider client={plants.client}>
        <PlantingsRepositoryProvider client={plantings.client}>
          <PlantingMap property={property} selectPlantingId={selectPlantingId} />
        </PlantingsRepositoryProvider>
      </PlantsRepositoryProvider>
    </BedsRepositoryProvider>,
  )
  return { beds, plants, plantings }
}

describe('PlantingMap', () => {
  it('prompts to draw a Bed first when there are none yet', async () => {
    renderMap({ bedRows: [] })
    expect(await screen.findByText('Draw a Bed first before adding Plantings.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add Planting' })).not.toBeInTheDocument()
  })

  it('lists existing Plantings with the Plant name, quantity, and Bed name', async () => {
    renderMap({ plantingRows: [PLANTING_ROW] })
    expect(await screen.findByText(/Coneflower ×3/)).toBeInTheDocument()
    expect(screen.getByText(/in Front border/)).toBeInTheDocument()
  })

  it('disables "Add Planting" when there are no Plants in the Registry yet', async () => {
    renderMap({ plantRows: [] })
    expect(await screen.findByRole('button', { name: 'Add Planting' })).toBeDisabled()
    expect(
      screen.getByText('Add a Plant to the Registry before creating a Planting.'),
    ).toBeInTheDocument()
  })

  it('opens the Add Planting form with the pin-placement prompt, and a disabled Save until a Plant is chosen', async () => {
    renderMap()
    await userEvent.click(await screen.findByRole('button', { name: 'Add Planting' }))

    expect(screen.getByLabelText('Plant *')).toBeInTheDocument()
    expect(screen.getByLabelText('Quantity *')).toBeInTheDocument()
    // The default Pin position happens to land inside BED_ROW (a large
    // rectangle covering the canvas center) — see BED_ROW's comment. Save
    // is still disabled because no Plant has been chosen yet.
    expect(screen.getByRole('button', { name: 'Save Planting' })).toBeDisabled()
  })

  it('shows "Drop the pin inside a Bed" when the default Pin position falls outside every Bed', async () => {
    renderMap({ bedRows: [FAR_BED_ROW] })
    await userEvent.click(await screen.findByRole('button', { name: 'Add Planting' }))

    expect(await screen.findByText('Drop the pin inside a Bed.')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Plant *'), 'plant-1')
    expect(screen.getByRole('button', { name: 'Save Planting' })).toBeDisabled()
  })

  it('creates a Planting once a Plant is chosen and the Pin resolves into a Bed', async () => {
    const { plantings } = renderMap()
    await userEvent.click(await screen.findByRole('button', { name: 'Add Planting' }))
    await userEvent.selectOptions(screen.getByLabelText('Plant *'), 'plant-1')
    await userEvent.clear(screen.getByLabelText('Quantity *'))
    await userEvent.type(screen.getByLabelText('Quantity *'), '24')

    const saveButton = screen.getByRole('button', { name: 'Save Planting' })
    expect(saveButton).toBeEnabled()
    await userEvent.click(saveButton)

    expect(await screen.findByText(/Coneflower ×24/)).toBeInTheDocument()
    expect(plantings.plantingRows()).toHaveLength(1)
    expect(plantings.plantingRows()[0].bed_id).toBe('bed-1')
  })

  it('cancels back out of the Add Planting form', async () => {
    renderMap()
    await userEvent.click(await screen.findByRole('button', { name: 'Add Planting' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('Plant *')).not.toBeInTheDocument()
  })

  it('opens a Planting’s details from its list entry, showing quantity, year, source, and an empty photo log', async () => {
    renderMap({ plantingRows: [PLANTING_ROW] })
    await userEvent.click(await screen.findByRole('button', { name: 'View Coneflower' }))

    const details = screen.getByRole('region', { name: 'Planting details' })
    expect(within(details).getByText('Quantity: 3')).toBeInTheDocument()
    expect(within(details).getByText('Year acquired: 2022')).toBeInTheDocument()
    expect(within(details).getByText('Source: Weston Nurseries')).toBeInTheDocument()
    expect(within(details).getByRole('heading', { name: 'Photo log' })).toBeInTheDocument()
  })

  it('adds a dated photo to a Planting’s photo log', async () => {
    const { plantings } = renderMap({ plantingRows: [PLANTING_ROW] })
    await userEvent.click(await screen.findByRole('button', { name: 'View Coneflower' }))

    const file = new File(['x'], 'bloom.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText('Add a dated photo'), file)

    // The date field defaults to today, since the photo log records when
    // the photo was taken, not when the row happened to be created.
    const today = new Date().toISOString().slice(0, 10)
    expect(await screen.findByText(today)).toBeInTheDocument()
    expect(plantings.photoRows()).toHaveLength(1)
  })

  it('removes a photo from the log', async () => {
    renderMap({
      plantingRows: [PLANTING_ROW],
      photoRows: [
        {
          id: 'photo-1',
          planting_id: 'planting-1',
          storage_path: 'user-1/planting-1/a.jpg',
          taken_on: '2026-06-01',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    })
    await userEvent.click(await screen.findByRole('button', { name: 'View Coneflower' }))

    expect(await screen.findByText('2026-06-01')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove photo from 2026-06-01' }))
    expect(screen.queryByText('2026-06-01')).not.toBeInTheDocument()
  })

  it('uses a Beds prop instead of self-fetching, so a Bed drawn in the sibling BedEditor shows up without a reload', async () => {
    const property = propertyFromRow(AVAILABLE_ROW)
    // The Beds client has no rows at all — if PlantingMap fell back to
    // self-fetching, it would see zero Beds and show the "draw a Bed
    // first" message instead of the one passed in via props.
    const beds = createFakeBedsDbClient([])
    const plants = createFakePlantsDbClient([PLANT_ROW])
    const plantings = createFakePlantingsDbClient([PLANTING_ROW])
    const propBed = {
      id: 'bed-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      propertyId: 'property-1',
      name: 'Front border',
      tool: 'rectangle' as const,
      points: BED_ROW.points,
      smoothingEnabled: false,
    }
    render(
      <BedsRepositoryProvider client={beds.client}>
        <PlantsRepositoryProvider client={plants.client}>
          <PlantingsRepositoryProvider client={plantings.client}>
            <PlantingMap property={property} beds={[propBed]} />
          </PlantingsRepositoryProvider>
        </PlantsRepositoryProvider>
      </BedsRepositoryProvider>,
    )

    expect(await screen.findByText(/Coneflower ×3/)).toBeInTheDocument()
    expect(screen.queryByText('Draw a Bed first before adding Plantings.')).not.toBeInTheDocument()
  })

  it('removes a Planting from the list', async () => {
    renderMap({ plantingRows: [PLANTING_ROW] })
    await screen.findByText(/Coneflower ×3/)
    await userEvent.click(screen.getByRole('button', { name: 'Remove Coneflower Planting' }))
    expect(screen.queryByText(/Coneflower ×3/)).not.toBeInTheDocument()
  })
})

describe('PlantingMap — jumping to a Planting (#10 Registry link)', () => {
  it('opens the requested Planting’s details automatically once loaded', async () => {
    renderMap({ plantingRows: [PLANTING_ROW], selectPlantingId: 'planting-1' })

    const details = await screen.findByRole('region', { name: 'Planting details' })
    expect(within(details).getByText('Quantity: 3')).toBeInTheDocument()
  })

  it('does not reopen the details panel after the gardener closes it', async () => {
    renderMap({ plantingRows: [PLANTING_ROW], selectPlantingId: 'planting-1' })
    await screen.findByRole('region', { name: 'Planting details' })

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('region', { name: 'Planting details' })).not.toBeInTheDocument()
  })

  it('does not reopen the details panel after Close just because an unrelated Planting was added elsewhere', async () => {
    renderMap({ plantingRows: [PLANTING_ROW], selectPlantingId: 'planting-1' })
    await screen.findByRole('region', { name: 'Planting details' })
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('region', { name: 'Planting details' })).not.toBeInTheDocument()

    // Creating a second, unrelated Planting gives `plantings` a new array
    // reference — this used to re-trigger the auto-select effect and
    // reopen the panel the gardener had just closed.
    await userEvent.click(await screen.findByRole('button', { name: 'Add Planting' }))
    await userEvent.selectOptions(screen.getByLabelText('Plant *'), 'plant-1')
    await userEvent.click(screen.getByRole('button', { name: 'Save Planting' }))
    await screen.findByText(/Coneflower ×1/)

    expect(screen.queryByRole('region', { name: 'Planting details' })).not.toBeInTheDocument()
  })

  it('does nothing when the requested Planting id matches nothing loaded', async () => {
    renderMap({ plantingRows: [PLANTING_ROW], selectPlantingId: 'no-such-planting' })
    await screen.findByText(/Coneflower ×3/)
    expect(screen.queryByRole('region', { name: 'Planting details' })).not.toBeInTheDocument()
  })
})
