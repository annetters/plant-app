import { DASHBOARD_TILES } from '@plant-app/domain'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'
import { supabase } from './lib/supabaseClient'
import { PlantsRepositoryProvider } from './plants/PlantsRepositoryContext'
import { asPlantsDbClient } from './plants/plantsRepository'
import { PlantingsRepositoryProvider } from './plantings/PlantingsRepositoryContext'
import { asPlantingsDbClient } from './plantings/plantingsRepository'
import { asBedsDbClient } from './property/bedsRepository'
import { BedsRepositoryProvider } from './property/BedsRepositoryContext'
import { PropertiesRepositoryProvider } from './property/PropertiesRepositoryContext'
import { asPropertiesDbClient } from './property/propertiesRepository'
import { BloomTimelinePage } from './routes/BloomTimelinePage'
import { ComingSoonPage } from './routes/ComingSoonPage'
import { DashboardPage } from './routes/DashboardPage'
import { LoginPage } from './routes/LoginPage'
import { PlantFormPage } from './routes/PlantFormPage'
import { PlantsPage } from './routes/PlantsPage'
import { PropertyPage } from './routes/PropertyPage'
import { SignUpPage } from './routes/SignUpPage'

/** Dashboard tiles with their own explicit `<Route>` below, rather than falling through to `ComingSoonPage`. */
const ROUTED_TILE_IDS = new Set(['registry', 'map', 'bloom-timeline'])

export function App() {
  return (
    <AuthProvider client={supabase}>
      <PlantsRepositoryProvider client={asPlantsDbClient(supabase)}>
        <PropertiesRepositoryProvider client={asPropertiesDbClient(supabase)}>
          <BedsRepositoryProvider client={asBedsDbClient(supabase)}>
            <PlantingsRepositoryProvider client={asPlantingsDbClient(supabase)}>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignUpPage />} />
                <Route
                  path="/dashboard"
                  element={
                    <RequireAuth>
                      <DashboardPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/registry"
                  element={
                    <RequireAuth>
                      <PlantsPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/registry/new"
                  element={
                    <RequireAuth>
                      <PlantFormPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/registry/:plantId"
                  element={
                    <RequireAuth>
                      <PlantFormPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/map"
                  element={
                    <RequireAuth>
                      <PropertyPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/bloom-timeline"
                  element={
                    <RequireAuth>
                      <BloomTimelinePage />
                    </RequireAuth>
                  }
                />
                {DASHBOARD_TILES.filter((tile) => !ROUTED_TILE_IDS.has(tile.id)).map((tile) => (
                  <Route
                    key={tile.id}
                    path={tile.path}
                    element={
                      <RequireAuth>
                        <ComingSoonPage title={tile.label} />
                      </RequireAuth>
                    }
                  />
                ))}
              </Routes>
            </PlantingsRepositoryProvider>
          </BedsRepositoryProvider>
        </PropertiesRepositoryProvider>
      </PlantsRepositoryProvider>
    </AuthProvider>
  )
}
