import { formatOption, type UsdaSpeciesSuggestedTraits } from '@plant-app/domain'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

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
  busy,
  onAccept,
  onSkip,
  footer,
}: {
  traits: UsdaSpeciesSuggestedTraits
  busy: boolean
  onAccept: () => void
  onSkip: () => void
  /** Whatever way out of this step the surrounding flow offers — cancelling a scan, or returning to the form. */
  footer?: ReactNode
}) {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        Suggested traits
      </Text>
      <Text>
        USDA PLANTS suggests the following for fields you haven't filled in yourself. Bloom window
        is never suggested — that's always your own observation.
      </Text>
      {traits.sunRequirement && <Text>Sun/shade: {formatOption(traits.sunRequirement)}</Text>}
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

      <Pressable accessibilityRole="button" disabled={busy} style={styles.button} onPress={onAccept}>
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
