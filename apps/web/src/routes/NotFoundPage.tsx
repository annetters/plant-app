import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main>
      <h1>Page not found</h1>
      <Link to="/dashboard">Back to Dashboard</Link>
    </main>
  )
}
