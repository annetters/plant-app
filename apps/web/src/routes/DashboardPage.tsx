import { DASHBOARD_TILES } from '@plant-app/domain'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function DashboardPage() {
  const { user, logOut } = useAuth()

  return (
    <main>
      <header>
        <h1>Dashboard</h1>
        <button onClick={() => logOut()}>Log out</button>
      </header>
      {user?.email && <p>Signed in as {user.email}</p>}
      <ul>
        {DASHBOARD_TILES.map((tile) => (
          <li key={tile.id}>
            <Link to={tile.path}>{tile.label}</Link>
          </li>
        ))}
      </ul>
      {/* Not one of the three tiles above — CONTEXT.md's Dashboard entry keeps task lists reachable but not surfaced immediately. */}
      <p>
        <Link to="/tasks">Tasks &amp; To-dos</Link>
      </p>
    </main>
  )
}
