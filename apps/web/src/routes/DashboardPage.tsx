import { DASHBOARD_TILES } from '@plant-app/domain'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function DashboardPage() {
  const { logOut } = useAuth()

  return (
    <main>
      <header>
        <h1>Dashboard</h1>
        <button onClick={() => logOut()}>Log out</button>
      </header>
      <ul>
        {DASHBOARD_TILES.map((tile) => (
          <li key={tile.id}>
            <Link to={tile.path}>{tile.label}</Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
