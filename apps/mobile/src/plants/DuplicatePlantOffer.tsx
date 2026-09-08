import { DUPLICATE_PLANT_OFFER, plantIdentityLabel, type Plant } from '@plant-app/domain'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

/**
 * The "you already have this Plant" step, shared by every native Plant
 * creation path — Tag Scan's review screen and the manual Registry form
 * (#37) — and presenting the same three decisions, in the same order, as
 * web's `/registry/new`. The wording itself lives in `@plant-app/domain`
 * (`DUPLICATE_PLANT_OFFER`) so the surfaces can't drift apart, which is the
 * whole point of the ticket: this offer used to exist on exactly one of the
 * three paths.
 *
 * Nothing is written here. Like `SuggestedTraitsConfirmation`, this renders
 * the decision and hands it straight back to the caller, which is what lets
 * each path keep its own follow-through (a scan also has tag photos to
 * attach; the manual form doesn't).
 */
export function DuplicatePlantOffer({
  existingPlant,
  busy,
  onViewExisting,
  onAddPlanting,
  onKeepEditing,
  onCreateAnyway,
  footer,
}: {
  existingPlant: Plant
  busy: boolean
  /** Open the matched Plant so the gardener can judge whether it really is the same one. Pushed, not replaced, so coming back leaves the half-filled form untouched. */
  onViewExisting: () => void
  /** Take up the offer: place a Planting against the record that already exists. */
  onAddPlanting: () => void
  /** Back to the form, unwritten — the entered fields are still there to correct. */
  onKeepEditing: () => void
  /** CONTEXT.md offers an alternative, it never prohibits: a gardener may genuinely want a second record. */
  onCreateAnyway: () => void
  /** Whatever way out of this step the surrounding flow offers — cancelling a scan, say. */
  footer?: ReactNode
}) {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        {DUPLICATE_PLANT_OFFER.heading}
      </Text>
      <Text style={styles.plantIdentity}>{plantIdentityLabel(existingPlant)}</Text>
      <Text>{DUPLICATE_PLANT_OFFER.body}</Text>

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        style={styles.buttonSecondary}
        onPress={onViewExisting}
      >
        <Text>{DUPLICATE_PLANT_OFFER.viewExistingAction}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        style={styles.button}
        onPress={onAddPlanting}
      >
        <Text style={styles.buttonText}>{DUPLICATE_PLANT_OFFER.addPlantingAction}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        style={styles.buttonSecondary}
        onPress={onKeepEditing}
      >
        <Text>{DUPLICATE_PLANT_OFFER.keepEditingAction}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        style={styles.buttonSecondary}
        onPress={onCreateAnyway}
      >
        <Text>{DUPLICATE_PLANT_OFFER.createAnywayAction}</Text>
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
  plantIdentity: {
    fontStyle: 'italic',
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
