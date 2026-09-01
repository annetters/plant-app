import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { OneOffTodosRepository, type OneOffTodosDbClient } from './oneOffTodosRepository'

const OneOffTodosRepositoryContext = createContext<OneOffTodosRepository | null>(null)

export function OneOffTodosRepositoryProvider({
  client,
  children,
}: {
  client: OneOffTodosDbClient
  children: ReactNode
}) {
  const repository = useMemo(() => new OneOffTodosRepository(client), [client])
  return (
    <OneOffTodosRepositoryContext.Provider value={repository}>
      {children}
    </OneOffTodosRepositoryContext.Provider>
  )
}

export function useOneOffTodosRepository(): OneOffTodosRepository {
  const repository = useContext(OneOffTodosRepositoryContext)
  if (!repository) {
    throw new Error('useOneOffTodosRepository must be used within a OneOffTodosRepositoryProvider')
  }
  return repository
}
