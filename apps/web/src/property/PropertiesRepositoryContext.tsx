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
