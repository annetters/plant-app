import type { Bed, Property } from '@plant-app/domain'
import { STAGE_SIZE_PX, pixelsPerFootForProperty } from '@plant-app/domain'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PlantingMap } from '../plantings/PlantingMap'
import { AddressAutocomplete } from '../property/AddressAutocomplete'
import { BaseMapBackground } from '../property/BaseMapBackground'
import { BaseMapSetup } from '../property/BaseMapSetup'
import { BedEditor } from '../property/BedEditor'
import { usePropertiesRepository } from '../property/PropertiesRepositoryContext'
import type { PropertyCreateInput } from '../property/propertiesRepository'

export function PropertyPage() {
  const repository = usePropertiesRepository()
  // Set by the Registry's "View on the map" link (#10) so a Planting's
  // details open automatically once the map loads, instead of the gardener
  // hunting for its Pin.
  const [searchParams] = useSearchParams()
  const selectPlantingId = searchParams.get('plantingId') ?? undefined
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
          {pixelsPerFootForProperty(property) !== null ? (
            <>
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
                hiddenWhileDrawing={bedEditorOpen}
              />
            </>
          ) : (
            <>
              <p>
                No aerial imagery is available for this property's location. Add a base map
                another way below.
              </p>
              <BaseMapSetup mode="update" property={property} onUpdated={setProperty} />
            </>
          )}
          <button type="button" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete Property'}
          </button>
        </section>
      )}

      <Link to="/dashboard">Back to Dashboard</Link>
    </main>
  )
}
