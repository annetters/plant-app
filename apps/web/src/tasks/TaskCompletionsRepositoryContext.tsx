import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { TaskCompletionsRepository, type TaskCompletionsDbClient } from './taskCompletionsRepository'

const TaskCompletionsRepositoryContext = createContext<TaskCompletionsRepository | null>(null)

export function TaskCompletionsRepositoryProvider({
  client,
  children,
}: {
  client: TaskCompletionsDbClient
  children: ReactNode
}) {
  const repository = useMemo(() => new TaskCompletionsRepository(client), [client])
  return (
    <TaskCompletionsRepositoryContext.Provider value={repository}>
      {children}
    </TaskCompletionsRepositoryContext.Provider>
  )
}

export function useTaskCompletionsRepository(): TaskCompletionsRepository {
  const repository = useContext(TaskCompletionsRepositoryContext)
  if (!repository) {
    throw new Error('useTaskCompletionsRepository must be used within a TaskCompletionsRepositoryProvider')
  }
  return repository
}
