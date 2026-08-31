import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { PlantsRepository, type PlantsDbClient } from './plantsRepository'

const PlantsRepositoryContext = createContext<PlantsRepository | null>(null)

export function PlantsRepositoryProvider({
  client,
  children,
}: {
  client: PlantsDbClient
  children: ReactNode
}) {
  const repository = useMemo(() => new PlantsRepository(client), [client])
  return (
    <PlantsRepositoryContext.Provider value={repository}>{children}</PlantsRepositoryContext.Provider>
  )
}

export function usePlantsRepository(): PlantsRepository {
  const repository = useContext(PlantsRepositoryContext)
  if (!repository) {
    throw new Error('usePlantsRepository must be used within a PlantsRepositoryProvider')
  }
  return repository
}
