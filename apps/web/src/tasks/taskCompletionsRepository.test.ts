import type { TaskCompletionRow } from '@plant-app/domain'
import { describe, expect, it } from 'vitest'
import { createFakeTaskCompletionsDbClient } from '../test/fakeTaskCompletionsDbClient'
import { TaskCompletionsRepository } from './taskCompletionsRepository'

function taskCompletionRow(overrides: Partial<TaskCompletionRow> = {}): TaskCompletionRow {
  return {
    id: 'completion-existing',
    care_task_template_id: 'template-1',
    planting_id: 'planting-1',
    year: 2025,
    status: 'done',
    created_at: '2025-04-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('TaskCompletionsRepository.listByPlanting', () => {
  it('returns only completions for the given Planting', async () => {
    const { client } = createFakeTaskCompletionsDbClient([
      taskCompletionRow({ id: 'c1', planting_id: 'planting-1' }),
      taskCompletionRow({ id: 'c2', planting_id: 'planting-2' }),
    ])
    const repository = new TaskCompletionsRepository(client)

    const result = await repository.listByPlanting('planting-1')

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('c1')
  })
})

describe('TaskCompletionsRepository.record', () => {
  it('inserts a new completion when none exists yet for that template/Planting/year', async () => {
    const { client, rows } = createFakeTaskCompletionsDbClient()
    const repository = new TaskCompletionsRepository(client)

    const result = await repository.record({
      careTaskTemplateId: 'template-1',
      plantingId: 'planting-1',
      year: 2026,
      status: 'done',
    })

    expect(result.status).toBe('done')
    expect(rows()).toHaveLength(1)
  })

  it('updates the existing completion instead of inserting a second row', async () => {
    const { client, rows } = createFakeTaskCompletionsDbClient([
      taskCompletionRow({
        id: 'c1',
        care_task_template_id: 'template-1',
        planting_id: 'planting-1',
        year: 2026,
        status: 'done',
      }),
    ])
    const repository = new TaskCompletionsRepository(client)

    const result = await repository.record({
      careTaskTemplateId: 'template-1',
      plantingId: 'planting-1',
      year: 2026,
      status: 'missed',
    })

    expect(result.id).toBe('c1')
    expect(result.status).toBe('missed')
    expect(rows()).toHaveLength(1)
  })

  it('does not update a completion recorded for a different year', async () => {
    const { client, rows } = createFakeTaskCompletionsDbClient([
      taskCompletionRow({
        id: 'c1',
        care_task_template_id: 'template-1',
        planting_id: 'planting-1',
        year: 2025,
        status: 'done',
      }),
    ])
    const repository = new TaskCompletionsRepository(client)

    await repository.record({
      careTaskTemplateId: 'template-1',
      plantingId: 'planting-1',
      year: 2026,
      status: 'missed',
    })

    expect(rows()).toHaveLength(2)
  })

  it('resolves the same way under two concurrent marks for the same trio, never leaving duplicate rows', async () => {
    const { client, rows } = createFakeTaskCompletionsDbClient()
    const repository = new TaskCompletionsRepository(client)
    const input = {
      careTaskTemplateId: 'template-1',
      plantingId: 'planting-1',
      year: 2026,
      status: 'done' as const,
    }

    await Promise.all([repository.record(input), repository.record(input)])

    expect(rows()).toHaveLength(1)
  })
})
