import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { TagScanRepository, type TagScanDbClient } from './tagScanRepository'

const TagScanRepositoryContext = createContext<TagScanRepository | null>(null)

export function TagScanRepositoryProvider({
  client,
  children,
}: {
  client: TagScanDbClient
  children: ReactNode
}) {
  const repository = useMemo(() => new TagScanRepository(client), [client])
  return (
    <TagScanRepositoryContext.Provider value={repository}>
      {children}
    </TagScanRepositoryContext.Provider>
  )
}

export function useTagScanRepository(): TagScanRepository {
  const repository = useContext(TagScanRepositoryContext)
  if (!repository) {
    throw new Error('useTagScanRepository must be used within a TagScanRepositoryProvider')
  }
  return repository
}
