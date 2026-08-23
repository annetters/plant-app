import type { BedRow, PropertyRow } from '@plant-app/domain'
import { propertyFromRow } from '@plant-app/domain'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeBedsDbClient } from '../test/fakeBedsDbClient'
import { BedEditor } from './BedEditor'
import { BedsRepositoryProvider } from './BedsRepositoryContext'

// jsdom has no real <canvas> 2D context (that needs the native `canvas` npm
// package, which we deliberately don't install — see vite.config.ts's konva
// alias comment). A real Konva Stage genuinely mounting/drawing is exercised
// by hand in a browser, not here; this stub is just enough surface for
// BedEditor's mount/render effects to run without throwing, so the
// surrounding React chrome (toolbar, fields, button state) is still
// unit-testable.
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
  created_at: '2026-01-01T00:00:00.000Z',
}

function setViewport(width: number, coarsePointer: boolean) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('coarse') ? coarsePointer : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

function renderEditor(bedRows: BedRow[] = []) {
  const property = propertyFromRow(AVAILABLE_ROW)
  const beds = createFakeBedsDbClient(bedRows)
  render(
    <BedsRepositoryProvider client={beds.client}>
      <BedEditor property={property} />
    </BedsRepositoryProvider>,
  )
  return beds
}

describe('BedEditor', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('on a desktop viewport', () => {
    beforeEach(() => setViewport(1440, false))

    it('offers a "Draw a Bed" trigger instead of the drawing surface up front', async () => {
      renderEditor()
      expect(await screen.findByRole('button', { name: 'Draw a Bed' })).toBeInTheDocument()
      expect(screen.queryByRole('toolbar', { name: 'Bed drawing tools' })).not.toBeInTheDocument()
    })

    it('opens the drawing surface with all four tools and a name field', async () => {
      renderEditor()
      await userEvent.click(await screen.findByRole('button', { name: 'Draw a Bed' }))

      const toolbar = screen.getByRole('toolbar', { name: 'Bed drawing tools' })
      for (const label of ['Freehand', 'Rectangle', 'Oval', 'Bezier pen']) {
        expect(within(toolbar).getByRole('button', { name: label })).toBeInTheDocument()
      }
      expect(screen.getByLabelText('Bed name')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Save Bed' })).toBeDisabled()
    })

    it('shows the smoothing toggle only for the freehand tool', async () => {
      renderEditor()
      await userEvent.click(await screen.findByRole('button', { name: 'Draw a Bed' }))
      expect(screen.getByLabelText('Smoothing')).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Rectangle' }))
      expect(screen.queryByLabelText('Smoothing')).not.toBeInTheDocument()
    })

    it('lists already-saved Beds with a Remove control', async () => {
      renderEditor([
        {
          id: 'bed-1',
          property_id: 'property-1',
          name: 'Front border',
          tool: 'freehand',
          points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }],
          smoothing_enabled: false,
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ])
      expect(await screen.findByText('Front border')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Remove Front border' })).toBeInTheDocument()
    })

    it('removes a Bed from the list', async () => {
      const bedRow: BedRow = {
        id: 'bed-1',
        property_id: 'property-1',
        name: 'Front border',
        tool: 'freehand',
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }],
        smoothing_enabled: false,
        created_at: '2026-01-01T00:00:00.000Z',
      }
      renderEditor([bedRow])
      await userEvent.click(await screen.findByRole('button', { name: 'Remove Front border' }))
      expect(screen.queryByText('Front border')).not.toBeInTheDocument()
    })
  })

  describe('on a non-desktop viewport', () => {
    it('shows a message instead of drawing tools on a narrow viewport', async () => {
      setViewport(500, false)
      renderEditor()
      expect(
        await screen.findByText('Bed drawing is available on a larger, non-touch screen.'),
      ).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Draw a Bed' })).not.toBeInTheDocument()
    })

    it('shows the message on a wide viewport with a coarse (touch) primary pointer', async () => {
      setViewport(1440, true)
      renderEditor()
      expect(
        await screen.findByText('Bed drawing is available on a larger, non-touch screen.'),
      ).toBeInTheDocument()
    })
  })
})
