import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { SpeciesLookupRepository, type SpeciesLookupDbClient } from './speciesLookupRepository'

const SpeciesLookupRepositoryContext = createContext<SpeciesLookupRepository | null>(null)

export function SpeciesLookupRepositoryProvider({
  client,
  children,
}: {
  client: SpeciesLookupDbClient
  children: ReactNode
}) {
  const repository = useMemo(() => new SpeciesLookupRepository(client), [client])
  return (
    <SpeciesLookupRepositoryContext.Provider value={repository}>
      {children}
    </SpeciesLookupRepositoryContext.Provider>
  )
}

export function useSpeciesLookupRepository(): SpeciesLookupRepository {
  const repository = useContext(SpeciesLookupRepositoryContext)
  if (!repository) {
    throw new Error(
      'useSpeciesLookupRepository must be used within a SpeciesLookupRepositoryProvider',
    )
  }
  return repository
}
