import type { AddressCandidate } from '@plant-app/domain'
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import type { PropertyCreateInput } from './propertiesRepository'
import { usePropertiesRepository } from './PropertiesRepositoryContext'

// Mirrors search-addresses/index.ts's own MIN_QUERY_LENGTH — keep the two in
// sync by hand (Deno edge functions can't import this npm workspace app).
// Kept here too, not just server-side, so the client avoids firing a
// network request the server would just answer with an empty list anyway.
const MIN_QUERY_LENGTH = 3
const DEBOUNCE_MS = 300

/**
 * A combobox over `search-addresses` candidates. A bare street with no
 * locality ("1 main st") is a geocoding shot in the dark across the whole
 * planet — this closes that gap by requiring a specific candidate to be
 * picked, never letting freeform text be submitted directly. `onSelect`
 * fires with a `PropertyCreateInput` (this component produces exactly what
 * `PropertiesRepository.create` needs), or `null` the moment a prior pick
 * is invalidated by further editing.
 */
export function AddressAutocomplete({
  onSelect,
}: {
  onSelect: (pick: PropertyCreateInput | null) => void
}) {
  const repository = usePropertiesRepository()
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<AddressCandidate[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null)
  const [confirmed, setConfirmed] = useState<AddressCandidate | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  async function runSearch(searchQuery: string) {
    const requestId = ++requestIdRef.current
    try {
      const results = await repository.search(searchQuery)
      if (requestId !== requestIdRef.current) return // a newer keystroke superseded this request
      setCandidates(results)
      setHighlightedIndex(results.length > 0 ? 0 : null)
      setOpen(true)
    } catch (err) {
      if (requestId !== requestIdRef.current) return
      setError(err instanceof Error ? err.message : 'Could not search for that address.')
      setCandidates([])
      setHighlightedIndex(null)
      setOpen(true)
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value
    setQuery(value)

    if (confirmed && value !== confirmed.displayName) {
      setConfirmed(null)
      onSelect(null)
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    // Every keystroke invalidates whatever search is in flight and clears
    // its (now-stale) candidates immediately, not just once the newer
    // search resolves — otherwise the previous query's options stay
    // visible and clickable during the debounce/fetch window, letting a
    // pick pair the just-typed text with a candidate from a different
    // search entirely.
    requestIdRef.current++
    setCandidates([])
    setHighlightedIndex(null)

    if (value.trim().length < MIN_QUERY_LENGTH) {
      setOpen(false)
      setLoading(false)
      setError(null)
      return
    }

    // Set immediately, not inside runSearch — otherwise the gap between this
    // keystroke and the debounce actually firing reads as "searched, found
    // nothing" (showNoMatches) rather than "about to search".
    setLoading(true)
    setError(null)
    setOpen(true)
    debounceRef.current = setTimeout(() => runSearch(value), DEBOUNCE_MS)
  }

  function selectCandidate(candidate: AddressCandidate) {
    const address = query
    setQuery(candidate.displayName)
    setConfirmed(candidate)
    setOpen(false)
    setCandidates([])
    setHighlightedIndex(null)
    onSelect({ address, candidate })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || candidates.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex((current) => Math.min((current ?? -1) + 1, candidates.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((current) => Math.max((current ?? candidates.length) - 1, 0))
    } else if (event.key === 'Enter') {
      if (highlightedIndex === null) return
      event.preventDefault()
      selectCandidate(candidates[highlightedIndex])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const showNoMatches =
    open && !loading && !error && candidates.length === 0 && query.trim().length >= MIN_QUERY_LENGTH

  return (
    <div className="address-autocomplete">
      <input
        id="property-address"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="address-candidates"
        aria-activedescendant={
          highlightedIndex !== null ? `address-candidate-${highlightedIndex}` : undefined
        }
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setOpen(false)}
        placeholder="e.g. 10 Main St, Cambridge, MA"
      />
      {open && loading && <p>Searching…</p>}
      {open && error && <p role="alert">{error}</p>}
      {showNoMatches && <p>No matches found.</p>}
      {open && candidates.length > 0 && (
        <ul id="address-candidates" role="listbox" onMouseDown={(event) => event.preventDefault()}>
          {candidates.map((candidate, index) => (
            <li
              key={`${candidate.latitude},${candidate.longitude}`}
              id={`address-candidate-${index}`}
              role="option"
              aria-selected={highlightedIndex === index}
              onClick={() => selectCandidate(candidate)}
            >
              {candidate.displayName}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
