import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { createMockAuthClient } from '../test/mockAuthClient'
import { DashboardPage } from './DashboardPage'

describe('DashboardPage', () => {
  it('shows a link to each of Map, Registry, and Bloom Timeline', () => {
    const { client } = createMockAuthClient(null)
    render(
      <MemoryRouter>
        <AuthProvider client={client}>
          <DashboardPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    for (const label of ['Map', 'Registry', 'Bloom Timeline']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
  })
})
