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
import { DashboardPage } from './routes/DashboardPage'
import { LoginPage } from './routes/LoginPage'
import { NotFoundPage } from './routes/NotFoundPage'
import { PlantFormPage } from './routes/PlantFormPage'
import { PlantsPage } from './routes/PlantsPage'
import { PropertyPage } from './routes/PropertyPage'
import { SignUpPage } from './routes/SignUpPage'

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
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </PlantingsRepositoryProvider>
          </BedsRepositoryProvider>
        </PropertiesRepositoryProvider>
      </PlantsRepositoryProvider>
    </AuthProvider>
  )
}
