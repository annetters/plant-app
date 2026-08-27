import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { PropertiesRepository, type PropertiesDbClient } from './propertiesRepository'

const PropertiesRepositoryContext = createContext<PropertiesRepository | null>(null)

export function PropertiesRepositoryProvider({
  client,
  children,
}: {
  client: PropertiesDbClient
  children: ReactNode
}) {
  const repository = useMemo(() => new PropertiesRepository(client), [client])
  return (
    <PropertiesRepositoryContext.Provider value={repository}>
      {children}
    </PropertiesRepositoryContext.Provider>
  )
}

export function usePropertiesRepository(): PropertiesRepository {
  const repository = useContext(PropertiesRepositoryContext)
  if (!repository) {
    throw new Error('usePropertiesRepository must be used within a PropertiesRepositoryProvider')
  }
  return repository
}

/**
 * Same context, without the throw — for a component like `BaseMapBackground`
 * that's mounted from both `PropertyPage` (always within the provider) and
 * from `BedEditor`/`PlantingMap`'s own isolated unit tests (which render
 * them without one, since neither test's fixtures use a `'photo'`
 * `baseMapSource` — the only branch that actually needs the repository).
 */
export function useOptionalPropertiesRepository(): PropertiesRepository | null {
  return useContext(PropertiesRepositoryContext)
}
