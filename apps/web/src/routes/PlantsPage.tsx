import type { Plant } from '@plant-app/domain'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlantsRepository } from '../plants/PlantsRepositoryContext'

export function PlantsPage() {
  const repository = usePlantsRepository()
  const [plants, setPlants] = useState<Plant[] | null>(null)
  const [error, setError] = useState<string | null>(null)

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
        <ul>
          {plants.map((plant) => (
            <li key={plant.id}>
              <Link to={`/registry/${plant.id}`}>
                {plant.commonName} — <em>{plant.scientificName}</em>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link to="/dashboard">Back to Dashboard</Link>
    </main>
  )
}
