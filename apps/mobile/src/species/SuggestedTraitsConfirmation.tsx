import {
  describeUsdaSpeciesProfile,
  type UsdaSpeciesProfile,
  type UsdaSpeciesSuggestedTraits,
} from '@plant-app/domain'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { hasApplicableTraits } from './speciesLookup'

/**
 * The "USDA suggests these traits — use them or skip" step, shared by both
 * Plant-creation paths (Tag Scan's review screen and the manual Registry
 * form, #31). Nothing here applies anything: it renders what was found and
 * hands the decision back to the caller, per CONTEXT.md's rule that a
 * lookup proposes and a human decides.
 *
 * Callers pass only the traits they would actually apply — see
 * `traitsNotAlreadySetBy` in `speciesLookup.ts`, which strips anything the
 * user has already filled in themselves.
 */
export function SuggestedTraitsConfirmation({
  traits,
  profile,
  traitSourceUnavailable,
  busy,
  onAccept,
  onSkip,
  footer,
}: {
  traits: UsdaSpeciesSuggestedTraits
  /**
   * Reference-only facts (#36). Shown, never saved, never offered for saving
   * — see `UsdaSpeciesProfile` in the domain for why each field is on that
   * side of the line, and why native status isn't here at all.
   */
  profile?: UsdaSpeciesProfile
  /** True when USDA couldn't be reached for traits — see `onSkip` below on why that must not read as "this species has none". */
  traitSourceUnavailable?: boolean
  busy: boolean
  onAccept: () => void
  onSkip: () => void
  /** Whatever way out of this step the surrounding flow offers — cancelling a scan, or returning to the form. */
  footer?: ReactNode
}) {
  const profileDescription = profile ? describeUsdaSpeciesProfile(profile) : null
  // Whether there is anything here to *accept*. Since #36 this panel also
  // opens for species USDA names but has no traits for — most garden
  // ornamentals — and offering "use these suggested traits" when there are
  // none to use is a button that does nothing.
  const canApplyAnything = hasApplicableTraits(traits)

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        {canApplyAnything ? 'Suggested traits' : 'What USDA knows about this species'}
      </Text>
      {canApplyAnything ? (
        <Text>
          USDA PLANTS suggests the following for fields you haven't filled in yourself. Bloom window
          is never suggested — that's always your own observation.
        </Text>
      ) : (
        <Text>
          Nothing here is filled in for you — USDA has no measurements for this species, which is
          ordinary for garden plants. It's shown so you know what was found.
        </Text>
      )}
      {traits.matureHeightInches !== undefined && (
        <Text>Mature height: {traits.matureHeightInches}"</Text>
      )}
      {traits.minimumHardinessZone !== undefined && (
        <Text style={styles.note}>
          For reference only, not saved automatically: USDA reports this species survives to about
          zone {traits.minimumHardinessZone} (no upper-zone data available) — add a full hardiness
          range yourself later if you'd like it recorded.
        </Text>
      )}
      {profileDescription && <Text style={styles.note}>{profileDescription}</Text>}
      {traitSourceUnavailable && (
        <Text style={styles.note}>
          USDA couldn't be reached for measurements just now, so this may be missing some — it
          doesn't mean there are none. The name above came from our own copy of USDA's plant list.
        </Text>
      )}

      {canApplyAnything ? (
        <>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            style={styles.button}
            onPress={onAccept}
          >
            <Text style={styles.buttonText}>Use these suggested traits</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            style={styles.buttonSecondary}
            onPress={onSkip}
          >
            <Text>Skip suggested traits</Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          style={styles.button}
          onPress={onSkip}
        >
          <Text style={styles.buttonText}>Save this Plant</Text>
        </Pressable>
      )}
      {footer}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  note: {
    color: '#555',
  },
  button: {
    backgroundColor: '#2e7d32',
    borderRadius: 4,
    padding: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: '#2e7d32',
    borderRadius: 4,
    padding: 12,
    alignItems: 'center',
  },
})
