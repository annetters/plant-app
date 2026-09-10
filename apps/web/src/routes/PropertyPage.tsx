import type { Bed, Property } from '@plant-app/domain'
import {
  STAGE_SIZE_PX,
  baseMapCalibration,
  formatMapWidthFeet,
  formatPixelsPerFoot,
} from '@plant-app/domain'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PlantingMap } from '../plantings/PlantingMap'
import { AddressAutocomplete } from '../property/AddressAutocomplete'
import { BaseMapBackground } from '../property/BaseMapBackground'
import { BaseMapSetup } from '../property/BaseMapSetup'
import { BedEditor } from '../property/BedEditor'
import { MeasurementGrid, MeasurementGridControl } from '../property/MeasurementGrid'
import { MeasurementGridProvider } from '../property/MeasurementGridContext'
import { usePropertiesRepository } from '../property/PropertiesRepositoryContext'
import type { PropertyCreateInput } from '../property/propertiesRepository'

export function PropertyPage() {
  const repository = usePropertiesRepository()
  // Set by the Registry's "View on the map" link (#10) so a Planting's
  // details open automatically once the map loads, instead of the gardener
  // hunting for its Pin.
  const [searchParams, setSearchParams] = useSearchParams()
  const selectPlantingId = searchParams.get('plantingId') ?? undefined
  // Set by the duplicate-Plant offer on `/registry/new` (#37) — "add a
  // Planting against the record you already have" has to arrive with that
  // record chosen, or it is just a link to the map.
  //
  // Unlike `?plantingId=` above, this one is a one-shot instruction rather
  // than a view to restore, so it's read once into state and then stripped
  // from the URL: left there, a reload or a Back into this page would remount
  // and spring the add form open again, long after the gardener cancelled it.
  const [startAddingForPlantId] = useState(
    () => searchParams.get('addPlantingForPlantId') ?? undefined,
  )
  useEffect(() => {
    if (!searchParams.has('addPlantingForPlantId')) return
    const remaining = new URLSearchParams(searchParams)
    remaining.delete('addPlantingForPlantId')
    setSearchParams(remaining, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [property, setProperty] = useState<Property | null | undefined>(undefined)
  const [pick, setPick] = useState<PropertyCreateInput | null>(null)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Up-front alternative to the address form, for a gardener who doesn't
  // want to use aerial imagery at all (unusable coverage, or privacy — see
  // CONTEXT.md's Property entry) rather than only reachable after an
  // address turns out to have no imagery.
  const [ownMapMode, setOwnMapMode] = useState(false)
  const [propertyName, setPropertyName] = useState('')
  const [confirmedName, setConfirmedName] = useState<string | null>(null)
  // Shared with PlantingMap below, via BedEditor's onBedsChange — so a Bed
  // drawn and saved in the editor is immediately visible for Pin placement,
  // not just after a reload. `null` until that first call arrives: "no Beds
  // yet" and "not known yet" look identical as an empty array, and the
  // base-map preview below has to tell them apart.
  const [beds, setBeds] = useState<Bed[] | null>(null)
  // Only so the base-map preview below can step aside while BedEditor is
  // rendering the same imagery behind its own canvas.
  const [bedEditorOpen, setBedEditorOpen] = useState(false)
  // #28: redoing a Scale Reference that's already set. Kept here rather than
  // inside BaseMapSetup so the whole calibrated view — maps, grid control and
  // all — stands down while the two points are being re-picked.
  const [recalibrating, setRecalibrating] = useState(false)

  // #28: what the Property's scale actually *is*, rather than only whether
  // there is one. Computed once and handed to the grid provider below, so
  // the summary line and the squares drawn on the map are describing one
  // calculation rather than two that happen to agree.
  const calibration = property ? baseMapCalibration(property) : null

  useEffect(() => {
    let cancelled = false
    repository
      .get()
      .then((result) => {
        if (!cancelled) setProperty(result)
      })
      .catch(() => {
        // Falls through to the address form rather than leaving the page
        // stuck on "Loading…" forever with no way to retry. Worst case if
        // a Property does exist and this was a transient failure: "Create
        // Property" fails with the one-per-account error below, which is
        // still recoverable — reloading the page tries the load again.
        if (!cancelled) {
          setFormError('Could not load your Property. You can try again below.')
          setProperty(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [repository])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)

    if (!pick) {
      setAddressError('Select an address from the results list.')
      return
    }
    setAddressError(null)
    setSubmitting(true)
    try {
      const created = await repository.create(pick)
      setProperty(created)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not create this Property.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!property) return
    if (!window.confirm('Delete this Property? This cannot be undone.')) return
    setDeleting(true)
    try {
      await repository.remove(property.id)
      setProperty(null)
      setOwnMapMode(false)
      setPropertyName('')
      setConfirmedName(null)
      setRecalibrating(false)
    } catch {
      setFormError('Could not delete this Property. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="property-page">
      <header>
        <h1>Map</h1>
      </header>

      {formError && <p role="alert">{formError}</p>}

      {property === undefined && <p>Loading…</p>}

      {property === null && !ownMapMode && (
        <>
          <form onSubmit={handleSubmit}>
            <label htmlFor="property-address">Address</label>
            <AddressAutocomplete
              onSelect={(next) => {
                setPick(next)
                setAddressError(null)
              }}
            />
            {addressError && <p role="alert">{addressError}</p>}
            <button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create Property'}
            </button>
          </form>
          <button type="button" onClick={() => setOwnMapMode(true)}>
            Don't want to use aerial imagery? Upload or draw your own base map instead.
          </button>
        </>
      )}

      {property === null && ownMapMode && confirmedName === null && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (propertyName.trim()) setConfirmedName(propertyName.trim())
          }}
        >
          <label htmlFor="property-name">Name your map</label>
          <input
            id="property-name"
            value={propertyName}
            onChange={(event) => setPropertyName(event.target.value)}
          />
          <button type="submit" disabled={!propertyName.trim()}>
            Continue
          </button>
          <button type="button" onClick={() => setOwnMapMode(false)}>
            Use aerial imagery instead
          </button>
        </form>
      )}

      {property === null && ownMapMode && confirmedName !== null && (
        <BaseMapSetup mode="create" name={confirmedName} onCreated={setProperty} />
      )}

      {property && (
        <MeasurementGridProvider calibration={calibration}>
        <section>
          <p>{property.address ?? property.name}</p>
          {property.resolvedAddress && (
            // A vague address (e.g. "1 main st", no city/state) still
            // geocodes to *something* — the geocoder's top-ranked guess,
            // silently. Showing what it actually matched, distinct from
            // what was typed, is what makes a bad match visible instead of
            // a Property quietly pinned to the wrong place.
            <p>Matched to: {property.resolvedAddress}</p>
          )}
          {/*
            #28: the derived scale, stated. Both halves matter — the
            px-per-ft figure is what the code actually multiplies by, but it
            reads as plausible whatever it is, so the ground width is what a
            gardener can actually falsify against their own lot. #6 shipped a
            1.5x-off calibration that a line like this would have made
            obvious on sight; it took a code review instead.

            Deliberately outside the branch below, so it stays on screen
            while a replacement is being picked: judging a new calibration
            means comparing it against the one being replaced, and hiding the
            old figure at exactly that moment would remove the comparison
            this whole ticket exists to make possible.
          */}
          {calibration?.calibrated && (
            <p className="base-map-scale">
              {recalibrating ? 'Current map scale' : 'Map scale'}:{' '}
              {formatPixelsPerFoot(calibration.pixelsPerFoot)} — this map covers{' '}
              {formatMapWidthFeet(calibration.mapWidthFeet)}.{' '}
              {recalibrating
                ? 'This is what saving a new Scale Reference below replaces.'
                : calibration.derivedFrom === 'aerial-imagery'
                  ? 'Derived from the aerial imagery and this location, so there is nothing to set by hand.'
                  : 'Derived from the Scale Reference you set on this base map.'}
            </p>
          )}

          {calibration?.calibrated && !recalibrating ? (
            <>
              {calibration.recalibratable && (
                <button type="button" onClick={() => setRecalibrating(true)}>
                  Recalibrate
                </button>
              )}
              <MeasurementGridControl />
              {/*
                A Property with no Beds yet has nothing else drawing its base
                map: BedEditor renders imagery only while its drawing panel
                is open, and PlantingMap's canvas stays hidden until a Bed
                exists (#25). Between them a freshly created Property showed
                no imagery at all — leaving no way to tell a correctly
                geocoded address from a wrong one, which is the whole job of
                this screen at that moment.

                This restores the standalone base map #6 removed (ffbc807).
                It was removed as a duplicate of BedEditor's copy, and that
                was true then only because PlantingMap's canvas still
                rendered unconditionally underneath. Gating on both
                conditions keeps the duplicate from coming back: whenever
                either of the two real drawing surfaces is showing the base
                map, this preview is not.
              */}
              {beds?.length === 0 && !bedEditorOpen && (
                <figure className="property-base-map-preview">
                  {/* Capped rather than fixed at STAGE_SIZE_PX: this is a
                      picture to look at, not a surface with a coordinate
                      space to honour, and it's the only wide thing on this
                      path — the two real canvases are desktop-only and
                      hidden respectively, so a fixed 768px would put a
                      phone into horizontal scroll for the first time. */}
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      maxWidth: STAGE_SIZE_PX,
                      aspectRatio: '1',
                    }}
                  >
                    <BaseMapBackground property={property} />
                    <MeasurementGrid />
                  </div>
                  <figcaption>Check this is the right place before drawing Beds.</figcaption>
                </figure>
              )}
              <BedEditor
                property={property}
                onBedsChange={setBeds}
                onOpenChange={setBedEditorOpen}
              />
              <PlantingMap
                property={property}
                beds={beds ?? []}
                selectPlantingId={selectPlantingId}
                startAddingForPlantId={startAddingForPlantId}
                hiddenWhileDrawing={bedEditorOpen}
              />
            </>
          ) : recalibrating ? (
            <BaseMapSetup
              mode="recalibrate"
              property={property}
              onUpdated={(updated) => {
                setProperty(updated)
                setRecalibrating(false)
              }}
              onCancel={() => setRecalibrating(false)}
            />
          ) : (
            <>
              {/*
                Two different failures land in this branch and want different
                wording. An aerial Property is here because its address had no
                imagery — the fix is to switch base-map source, so we say so.
                A photo/drawn Property is here because it just hasn't been
                calibrated yet; #29 was the wording telling that gardener to
                re-check their address, which predates #6's rework when
                photo/drawn only existed as an aerial fallback.
              */}
              {property.baseMapSource === 'aerial' ? (
                <p>
                  No aerial imagery is available for this property's location. Add a base map
                  another way below.
                </p>
              ) : (
                <p>
                  This Property has no Scale Reference calibrated yet, so its Beds and Pins
                  can't be drawn to scale. Finish setting up its base map below.
                </p>
              )}
              <BaseMapSetup mode="update" property={property} onUpdated={setProperty} />
            </>
          )}
          <button type="button" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete Property'}
          </button>
        </section>
        </MeasurementGridProvider>
      )}

      <Link to="/dashboard">Back to Dashboard</Link>
    </main>
  )
}
