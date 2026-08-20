import { DASHBOARD_TILES } from '@plant-app/domain'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'
import { supabase } from './lib/supabaseClient'
import { ComingSoonPage } from './routes/ComingSoonPage'
import { DashboardPage } from './routes/DashboardPage'
import { LoginPage } from './routes/LoginPage'
import { SignUpPage } from './routes/SignUpPage'

export function App() {
  return (
    <AuthProvider client={supabase}>
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
        {DASHBOARD_TILES.map((tile) => (
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
    </AuthProvider>
  )
}
