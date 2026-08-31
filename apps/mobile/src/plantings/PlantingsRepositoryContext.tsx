import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { PlantingsRepository, type PlantingsDbClient } from './plantingsRepository'

const PlantingsRepositoryContext = createContext<PlantingsRepository | null>(null)

export function PlantingsRepositoryProvider({
  client,
  children,
}: {
  client: PlantingsDbClient
  children: ReactNode
}) {
  const repository = useMemo(() => new PlantingsRepository(client), [client])
  return (
    <PlantingsRepositoryContext.Provider value={repository}>
      {children}
    </PlantingsRepositoryContext.Provider>
  )
}

export function usePlantingsRepository(): PlantingsRepository {
  const repository = useContext(PlantingsRepositoryContext)
  if (!repository) {
    throw new Error('usePlantingsRepository must be used within a PlantingsRepositoryProvider')
  }
  return repository
}
