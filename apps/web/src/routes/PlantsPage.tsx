import type {
  Bed,
  FoliageType,
  NativeStatus,
  Plant,
  Planting,
  RegistryFilters,
  SunRequirement,
} from '@plant-app/domain'
import { FOLIAGE_TYPES, NATIVE_STATUSES, SUN_REQUIREMENTS, filterRegistryEntries } from '@plant-app/domain'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MONTH_NAMES } from '../monthNames'
import { formatOption } from '../plants/formatOption'
import { plantLabel } from '../plants/plantLabel'
import { usePlantsRepository } from '../plants/PlantsRepositoryContext'
import { usePlantingsRepository } from '../plantings/PlantingsRepositoryContext'
import { useBedsRepository } from '../property/BedsRepositoryContext'
import { usePropertiesRepository } from '../property/PropertiesRepositoryContext'

/**
 * Registry (#10, see CONTEXT.md): the searchable, filterable Plant list.
 * `filterRegistryEntries` does the actual filtering across every combined
 * axis; this page only fetches what it needs and renders the result. Beds
 * and Plantings are fetched purely to link each entry to its Planting
 * location(s) on the map — a secondary feature, so a failure loading them
 * doesn't block the primary Plant list or its search/filter.
 */
export function PlantsPage() {
  const repository = usePlantsRepository()
  const propertiesRepository = usePropertiesRepository()
  const bedsRepository = useBedsRepository()
  const plantingsRepository = usePlantingsRepository()

  const [plants, setPlants] = useState<Plant[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [beds, setBeds] = useState<Bed[]>([])
  const [plantings, setPlantings] = useState<Planting[]>([])

  const [search, setSearch] = useState('')
  const [flowerColor, setFlowerColor] = useState('')
  const [bloomMonth, setBloomMonth] = useState('')
  const [sunRequirement, setSunRequirement] = useState<SunRequirement | ''>('')
  const [foliageType, setFoliageType] = useState<FoliageType | ''>('')
  const [nativeStatus, setNativeStatus] = useState<NativeStatus | ''>('')

  useEffect(() => {
    let cancelled = false
    repository
      .list()
      .then((result) => {
        if (!cancelled) setPlants(result)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your plants. Please try again.')
      })
    return () => {
      cancelled = true
    }
  }, [repository])

  useEffect(() => {
    let cancelled = false
    propertiesRepository
      .get()
      .then((property) => {
        if (cancelled || !property) return undefined
        return bedsRepository.list(property.id).then((result) => {
          if (!cancelled) setBeds(result)
        })
      })
      .catch(() => {
        // Planting-location links are a nice-to-have on top of the primary
        // Plant list — a failure loading the Property/Beds shouldn't block
        // search/filtering, which works from `plants` alone.
      })
    return () => {
      cancelled = true
    }
  }, [propertiesRepository, bedsRepository])

  useEffect(() => {
    if (beds.length === 0) {
      setPlantings([])
      return
    }
    let cancelled = false
    plantingsRepository
      .listByBeds(beds.map((bed) => bed.id))
      .then((result) => {
        if (!cancelled) setPlantings(result)
      })
      .catch(() => {
        // Same reasoning as the Beds fetch above — non-blocking.
      })
    return () => {
      cancelled = true
    }
  }, [beds, plantingsRepository])

  const filters: RegistryFilters = useMemo(
    () => ({
      ...(search !== '' && { search }),
      ...(flowerColor !== '' && { flowerColor }),
      ...(bloomMonth !== '' && { bloomMonth: Number(bloomMonth) }),
      ...(sunRequirement !== '' && { sunRequirement }),
      ...(foliageType !== '' && { foliageType }),
      ...(nativeStatus !== '' && { nativeStatus }),
    }),
    [search, flowerColor, bloomMonth, sunRequirement, foliageType, nativeStatus],
  )

  const filteredPlants = useMemo(
    () => (plants ? filterRegistryEntries(plants, filters) : []),
    [plants, filters],
  )

  // Built once per Beds/Plantings load rather than re-scanned per rendered
  // Plant (which would otherwise cost an O(plants × plantings) pass on
  // every render, including every filter keystroke).
  const plantingsByPlantId = useMemo(() => {
    const map = new Map<string, Planting[]>()
    for (const planting of plantings) {
      const existing = map.get(planting.plantId)
      if (existing) existing.push(planting)
      else map.set(planting.plantId, [planting])
    }
    return map
  }, [plantings])

  const bedsById = useMemo(() => new Map(beds.map((bed) => [bed.id, bed])), [beds])

  return (
    <main>
      <header>
        <h1>Registry</h1>
        <Link to="/registry/new">Add Plant</Link>
      </header>

      {error && <p role="alert">{error}</p>}
      {plants === null && !error && <p>Loading…</p>}
      {plants && plants.length === 0 && <p>No plants yet — add your first one.</p>}

      {plants && plants.length > 0 && (
        <>
          <fieldset>
            <legend>Filter</legend>

            <label htmlFor="registry-search">Search</label>
            <input
              id="registry-search"
              type="search"
              placeholder="Name or cultivar"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <label htmlFor="registry-flower-color">Flower color</label>
            <input
              id="registry-flower-color"
              value={flowerColor}
              onChange={(event) => setFlowerColor(event.target.value)}
            />

            <label htmlFor="registry-bloom-month">Bloom month</label>
            <select
              id="registry-bloom-month"
              value={bloomMonth}
              onChange={(event) => setBloomMonth(event.target.value)}
            >
              <option value="">Any month</option>
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>

            <label htmlFor="registry-sun-requirement">Sun/shade</label>
            <select
              id="registry-sun-requirement"
              value={sunRequirement}
              onChange={(event) => setSunRequirement(event.target.value as SunRequirement | '')}
            >
              <option value="">Any</option>
              {SUN_REQUIREMENTS.map((value) => (
                <option key={value} value={value}>
                  {formatOption(value)}
                </option>
              ))}
            </select>

            <label htmlFor="registry-foliage-type">Foliage</label>
            <select
              id="registry-foliage-type"
              value={foliageType}
              onChange={(event) => setFoliageType(event.target.value as FoliageType | '')}
            >
              <option value="">Any</option>
              {FOLIAGE_TYPES.map((value) => (
                <option key={value} value={value}>
                  {formatOption(value)}
                </option>
              ))}
            </select>

            <label htmlFor="registry-native-status">Native status</label>
            <select
              id="registry-native-status"
              value={nativeStatus}
              onChange={(event) => setNativeStatus(event.target.value as NativeStatus | '')}
            >
              <option value="">Any</option>
              {NATIVE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {formatOption(value)}
                </option>
              ))}
            </select>
          </fieldset>

          {filteredPlants.length === 0 && <p>No Plants match these filters.</p>}

          {filteredPlants.length > 0 && (
            <ul className="plant-list">
              {filteredPlants.map((plant) => {
                const locations = plantingsByPlantId.get(plant.id) ?? []
                return (
                  <li key={plant.id}>
                    <Link to={`/registry/${plant.id}`}>
                      {plant.commonName} — <em>{plant.scientificName}</em>
                    </Link>
                    {locations.length > 0 && (
                      <ul aria-label={`${plantLabel(plant)} Planting locations`}>
                        {locations.map((planting) => {
                          const bed = bedsById.get(planting.bedId)
                          return (
                            <li key={planting.id}>
                              <Link to={`/map?plantingId=${planting.id}`}>
                                View in {bed?.name ?? 'Bed'} on the map
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      <Link to="/dashboard">Back to Dashboard</Link>
    </main>
  )
}
