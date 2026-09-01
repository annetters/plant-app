import type { OneOffTodoRow } from '@plant-app/domain'
import { describe, expect, it } from 'vitest'
import { createFakeOneOffTodosDbClient } from '../test/fakeOneOffTodosDbClient'
import { OneOffTodosRepository } from './oneOffTodosRepository'

function oneOffTodoRow(overrides: Partial<OneOffTodoRow> = {}): OneOffTodoRow {
  return {
    id: 'todo-existing',
    text: 'Order mulch',
    done: false,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('OneOffTodosRepository.list', () => {
  it('lists todos in creation order', async () => {
    const { client } = createFakeOneOffTodosDbClient([
      oneOffTodoRow({ id: 't1', created_at: '2026-01-01T00:00:00.000Z' }),
      oneOffTodoRow({ id: 't2', created_at: '2026-01-02T00:00:00.000Z' }),
    ])
    const repository = new OneOffTodosRepository(client)

    const result = await repository.list()

    expect(result.map((todo) => todo.id)).toEqual(['t1', 't2'])
  })
})

describe('OneOffTodosRepository.create', () => {
  it('creates a new todo, not done by default', async () => {
    const { client } = createFakeOneOffTodosDbClient()
    const repository = new OneOffTodosRepository(client)

    const created = await repository.create({ text: 'Order mulch' })

    expect(created.text).toBe('Order mulch')
    expect(created.done).toBe(false)
  })
})

describe('OneOffTodosRepository.setDone', () => {
  it('toggles a todo done', async () => {
    const { client } = createFakeOneOffTodosDbClient([oneOffTodoRow({ id: 't1', done: false })])
    const repository = new OneOffTodosRepository(client)

    const updated = await repository.setDone('t1', true)

    expect(updated.done).toBe(true)
  })
})

describe('OneOffTodosRepository.remove', () => {
  it('removes a todo', async () => {
    const { client, rows } = createFakeOneOffTodosDbClient([oneOffTodoRow({ id: 't1' })])
    const repository = new OneOffTodosRepository(client)

    await repository.remove('t1')

    expect(rows()).toHaveLength(0)
  })
})
