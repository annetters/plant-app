import { aerialTileUrl, lonLatToTile, type Property } from '@plant-app/domain'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { usePropertiesRepository } from '../property/PropertiesRepositoryContext'

// A fixed grid around the property's center tile. Wide enough to show the
// property and its immediate surroundings without panning — panning/zooming
// is out of scope here, since the base map isn't drawable yet (a later
// ticket owns Bed drawing).
const GRID_RADIUS = 1

function baseMapTiles(property: Property): { key: string; url: string }[] {
  if (property.imageryZoom === null) return []
  const center = lonLatToTile(property.latitude, property.longitude, property.imageryZoom)
  const tiles: { key: string; url: string }[] = []
  for (let dy = -GRID_RADIUS; dy <= GRID_RADIUS; dy++) {
    for (let dx = -GRID_RADIUS; dx <= GRID_RADIUS; dx++) {
      const x = center.x + dx
      const y = center.y + dy
      tiles.push({ key: `${x}-${y}`, url: aerialTileUrl(property.imageryZoom, x, y) })
    }
  }
  return tiles
}

export function PropertyPage() {
  const repository = usePropertiesRepository()
  const [property, setProperty] = useState<Property | null | undefined>(undefined)
  const [address, setAddress] = useState('')
  const [addressError, setAddressError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

    if (!address.trim()) {
      setAddressError('Address is required.')
      return
    }
    setAddressError(null)
    setSubmitting(true)
    try {
      const created = await repository.create(address)
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
    } catch {
      setFormError('Could not delete this Property. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main>
      <header>
        <h1>Map</h1>
      </header>

      {formError && <p role="alert">{formError}</p>}

      {property === undefined && <p>Loading…</p>}

      {property === null && (
        <form onSubmit={handleSubmit}>
          <label htmlFor="property-address">Address</label>
          <input
            id="property-address"
            type="text"
            value={address}
            onChange={(event) => {
              setAddress(event.target.value)
              setAddressError(null)
            }}
            placeholder="e.g. 10 Main St, Cambridge, MA"
          />
          {addressError && <p role="alert">{addressError}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Property'}
          </button>
        </form>
      )}

      {property && (
        <section>
          <p>{property.address}</p>
          {property.resolvedAddress && (
            // A vague address (e.g. "1 main st", no city/state) still
            // geocodes to *something* — the geocoder's top-ranked guess,
            // silently. Showing what it actually matched, distinct from
            // what was typed, is what makes a bad match visible instead of
            // a Property quietly pinned to the wrong place.
            <p>Matched to: {property.resolvedAddress}</p>
          )}
          {property.imageryAvailable ? (
            <div
              className="property-base-map"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${GRID_RADIUS * 2 + 1}, 1fr)`,
                gap: 0,
                maxWidth: 512,
              }}
            >
              {baseMapTiles(property).map((tile) => (
                <img key={tile.key} src={tile.url} alt="Aerial base map imagery" />
              ))}
            </div>
          ) : (
            <p>
              No aerial imagery is available for this property's location. A photographed plot
              plan or an in-app drawn base map will cover this case in a later ticket.
            </p>
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
