import type { CareTaskTemplate, Plant, Planting, TaskCompletion, TaskCompletionStatus } from '@plant-app/domain'
import { buildPlantingTaskHistory, plantLabel, validateTaskCompletionInput } from '@plant-app/domain'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePlantingsRepository } from '../plantings/PlantingsRepositoryContext'
import { usePlantsRepository } from '../plants/PlantsRepositoryContext'
import { useTaskCompletionsRepository } from '../tasks/TaskCompletionsRepositoryContext'

/** A Planting's reviewable care history for one calendar year (ticket #12) — one row per Care task template on its Plant, mark done/missed. */
export function PlantingTaskHistoryPage() {
  const { plantingId } = useParams<{ plantingId: string }>()
  const plantingsRepository = usePlantingsRepository()
  const plantsRepository = usePlantsRepository()
  const taskCompletionsRepository = useTaskCompletionsRepository()

  const [planting, setPlanting] = useState<Planting | null | undefined>(undefined)
  const [plant, setPlant] = useState<Plant | null>(null)
  const [templates, setTemplates] = useState<CareTaskTemplate[]>([])
  const [completions, setCompletions] = useState<TaskCompletion[]>([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [loadError, setLoadError] = useState<string | null>(null)
  const [markError, setMarkError] = useState<string | null>(null)

  useEffect(() => {
    if (!plantingId) return
    let cancelled = false
    plantingsRepository
      .get(plantingId)
      .then((result) => {
        if (!cancelled) setPlanting(result)
      })
      .catch(() => {
        if (!cancelled) {
          setPlanting(null)
          setLoadError('Could not load this Planting.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [plantingId, plantingsRepository])

  useEffect(() => {
    if (!planting) return
    let cancelled = false
    plantsRepository
      .get(planting.plantId)
      .then((result) => {
        if (!cancelled) setPlant(result)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load this Planting’s Plant.')
      })
    plantsRepository
      .listCareTaskTemplates(planting.plantId)
      .then((result) => {
        if (!cancelled) setTemplates(result)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load this Plant’s Care task templates.')
      })
    return () => {
      cancelled = true
    }
  }, [planting, plantsRepository])

  useEffect(() => {
    if (!plantingId) return
    let cancelled = false
    taskCompletionsRepository
      .listByPlanting(plantingId)
      .then((result) => {
        if (!cancelled) setCompletions(result)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load this Planting’s task history.')
      })
    return () => {
      cancelled = true
    }
  }, [plantingId, taskCompletionsRepository])

  async function handleMark(templateId: string, status: TaskCompletionStatus) {
    if (!plantingId) return
    const input = { careTaskTemplateId: templateId, plantingId, year, status }
    const validation = validateTaskCompletionInput(input)
    if (!validation.ok) {
      setMarkError(Object.values(validation.errors)[0] ?? 'Could not record this task.')
      return
    }
    setMarkError(null)
    try {
      const recorded = await taskCompletionsRepository.record(input)
      setCompletions((current) => [
        ...current.filter((completion) => completion.id !== recorded.id),
        recorded,
      ])
    } catch (error) {
      setMarkError(error instanceof Error ? error.message : 'Could not record this task.')
    }
  }

  // Computed before the loading/not-found returns below so this hook is
  // never called conditionally — harmless while planting is still null/
  // undefined, since templates/completions are empty in that state too.
  const history = useMemo(
    () => buildPlantingTaskHistory(templates, completions, planting?.id ?? '', year),
    [templates, completions, planting?.id, year],
  )

  if (planting === undefined) {
    return (
      <main>
        <p>Loading…</p>
      </main>
    )
  }

  if (planting === null) {
    return (
      <main>
        {loadError && <p role="alert">{loadError}</p>}
        <p>This Planting could not be found.</p>
        <Link to="/tasks">Back to Tasks &amp; To-dos</Link>
      </main>
    )
  }

  return (
    <main>
      <header>
        <h1>{plantLabel(plant ?? undefined)} task history</h1>
        <Link to="/tasks">Back to Tasks &amp; To-dos</Link>
      </header>
      {loadError && <p role="alert">{loadError}</p>}
      {markError && <p role="alert">{markError}</p>}

      <label htmlFor="task-history-year">Year</label>
      <input
        id="task-history-year"
        type="number"
        value={year}
        onChange={(event) => setYear(Number(event.target.value))}
      />

      {templates.length === 0 ? (
        <p>This Plant has no Care task templates yet.</p>
      ) : (
        <ul>
          {history.map((entry) => (
            <li key={entry.careTaskTemplateId}>
              <span>{entry.careTaskTemplateName}</span>
              <span> — {entry.status}</span>
              <button
                type="button"
                onClick={() => handleMark(entry.careTaskTemplateId, 'done')}
                disabled={entry.status === 'done'}
              >
                Mark done
              </button>
              <button
                type="button"
                onClick={() => handleMark(entry.careTaskTemplateId, 'missed')}
                disabled={entry.status === 'missed'}
              >
                Mark missed
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
