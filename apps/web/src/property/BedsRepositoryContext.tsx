import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { BedsRepository, type BedsDbClient } from './bedsRepository'

const BedsRepositoryContext = createContext<BedsRepository | null>(null)

export function BedsRepositoryProvider({
  client,
  children,
}: {
  client: BedsDbClient
  children: ReactNode
}) {
  const repository = useMemo(() => new BedsRepository(client), [client])
  return (
    <BedsRepositoryContext.Provider value={repository}>{children}</BedsRepositoryContext.Provider>
  )
}

export function useBedsRepository(): BedsRepository {
  const repository = useContext(BedsRepositoryContext)
  if (!repository) {
    throw new Error('useBedsRepository must be used within a BedsRepositoryProvider')
  }
  return repository
}
