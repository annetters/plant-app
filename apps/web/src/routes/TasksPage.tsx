import type { Bed, OneOffTodo, Plant, Planting, Property } from '@plant-app/domain'
import { plantLabel, validateOneOffTodoInput } from '@plant-app/domain'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { usePlantingsRepository } from '../plantings/PlantingsRepositoryContext'
import { usePlantsRepository } from '../plants/PlantsRepositoryContext'
import { useBedsRepository } from '../property/BedsRepositoryContext'
import { usePropertiesRepository } from '../property/PropertiesRepositoryContext'
import { useOneOffTodosRepository } from '../tasks/OneOffTodosRepositoryContext'

/**
 * The Task/todo hub (ticket #12): a Planting's task history is one hop away
 * (via its own page), plus one-off todos live here directly. Reachable from
 * the Dashboard via a plain link, not one of its three main tiles — per
 * CONTEXT.md's Dashboard entry, task lists aren't surfaced immediately.
 */
export function TasksPage() {
  const propertiesRepository = usePropertiesRepository()
  const bedsRepository = useBedsRepository()
  const plantingsRepository = usePlantingsRepository()
  const plantsRepository = usePlantsRepository()
  const oneOffTodosRepository = useOneOffTodosRepository()

  const [property, setProperty] = useState<Property | null | undefined>(undefined)
  const [beds, setBeds] = useState<Bed[]>([])
  const [plantings, setPlantings] = useState<Planting[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const [todos, setTodos] = useState<OneOffTodo[]>([])
  const [todoText, setTodoText] = useState('')
  const [todoError, setTodoError] = useState<string | null>(null)
  const [savingTodo, setSavingTodo] = useState(false)

  useEffect(() => {
    let cancelled = false
    propertiesRepository
      .get()
      .then((result) => {
        if (!cancelled) setProperty(result)
      })
      .catch(() => {
        if (!cancelled) {
          setProperty(null)
          setLoadError('Could not load your Property.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [propertiesRepository])

  useEffect(() => {
    if (!property) return
    let cancelled = false
    bedsRepository
      .list(property.id)
      .then((result) => {
        if (!cancelled) setBeds(result)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load your Beds.')
      })
    return () => {
      cancelled = true
    }
  }, [property, bedsRepository])

  useEffect(() => {
    if (beds.length === 0) {
      setPlantings([])
      return
    }
    let cancelled = false
    plantingsRepository
      .listByBeds(beds.map((bed) => bed.id))
      .then((result) => {
        if (!cancelled) setPlantings(result)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load your Plantings.')
      })
    return () => {
      cancelled = true
    }
  }, [beds, plantingsRepository])

  useEffect(() => {
    let cancelled = false
    plantsRepository
      .list()
      .then((result) => {
        if (!cancelled) setPlants(result)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load your Plants.')
      })
    return () => {
      cancelled = true
    }
  }, [plantsRepository])

  useEffect(() => {
    let cancelled = false
    oneOffTodosRepository
      .list()
      .then((result) => {
        if (!cancelled) setTodos(result)
      })
      .catch(() => {
        if (!cancelled) setTodoError('Could not load your to-dos.')
      })
    return () => {
      cancelled = true
    }
  }, [oneOffTodosRepository])

  async function handleAddTodo(event: FormEvent) {
    event.preventDefault()
    const input = { text: todoText }
    const validation = validateOneOffTodoInput(input)
    if (!validation.ok) {
      setTodoError(Object.values(validation.errors)[0] ?? 'Could not add this to-do.')
      return
    }
    setTodoError(null)
    setSavingTodo(true)
    try {
      const created = await oneOffTodosRepository.create(input)
      setTodos((current) => [...current, created])
      setTodoText('')
    } catch (error) {
      setTodoError(error instanceof Error ? error.message : 'Could not add this to-do.')
    } finally {
      setSavingTodo(false)
    }
  }

  async function handleToggleTodo(todo: OneOffTodo) {
    try {
      const updated = await oneOffTodosRepository.setDone(todo.id, !todo.done)
      setTodos((current) => current.map((t) => (t.id === updated.id ? updated : t)))
    } catch {
      setTodoError('Could not update this to-do.')
    }
  }

  async function handleRemoveTodo(id: string) {
    try {
      await oneOffTodosRepository.remove(id)
      setTodos((current) => current.filter((t) => t.id !== id))
    } catch {
      setTodoError('Could not remove this to-do.')
    }
  }

  return (
    <main>
      <header>
        <h1>Tasks &amp; To-dos</h1>
        <Link to="/dashboard">Back to Dashboard</Link>
      </header>
      {loadError && <p role="alert">{loadError}</p>}

      <section aria-label="One-off todos">
        <h2>One-off to-dos</h2>
        {todoError && <p role="alert">{todoError}</p>}
        <ul>
          {todos.map((todo) => (
            <li key={todo.id}>
              <label>
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() => handleToggleTodo(todo)}
                />
                <span style={todo.done ? { textDecoration: 'line-through' } : undefined}>
                  {todo.text}
                </span>
              </label>
              <button
                type="button"
                aria-label={`Remove to-do: ${todo.text}`}
                onClick={() => handleRemoveTodo(todo.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddTodo}>
          <label htmlFor="new-todo-text">Add a to-do</label>
          <input
            id="new-todo-text"
            value={todoText}
            onChange={(event) => setTodoText(event.target.value)}
          />
          <button type="submit" disabled={savingTodo}>
            {savingTodo ? 'Adding…' : 'Add'}
          </button>
        </form>
      </section>

      <section aria-label="Planting task history">
        <h2>Plantings</h2>
        {property === null && <p>Set up your Property to start tracking Planting tasks.</p>}
        {plantings.length === 0 && property && <p>No Plantings yet.</p>}
        <ul>
          {plantings.map((planting) => {
            const plant = plants.find((p) => p.id === planting.plantId)
            return (
              <li key={planting.id}>
                <Link to={`/tasks/plantings/${planting.id}`}>
                  {plantLabel(plant)} task history
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </main>
  )
}
