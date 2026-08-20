import { Link } from 'react-router-dom'

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <main>
      <h1>{title}</h1>
      <p>Coming soon.</p>
      <Link to="/dashboard">Back to Dashboard</Link>
    </main>
  )
}
