import { forwardRef, type ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native'
import type { ScrollViewProps } from 'react-native'

/**
 * A `ScrollView` that gets out of the keyboard's way.
 *
 * Every form screen in this app needs the identical pairing, and #14's device
 * QA found what its absence costs: on the Map screen the number pad opened
 * straight over the "Year acquired" field being typed into, with the field
 * scrolled out of sight behind it. Only the two auth screens had ever set this
 * up, so the same bug was waiting on every other screen with a `TextInput`.
 *
 * `keyboardShouldPersistTaps="handled"` earns its place twice: it lets the
 * keyboard be dismissed by tapping the page, and — the non-obvious half — it
 * stops the first tap on anything interactive from being swallowed as a
 * dismiss while the keyboard is up. On the Map that first tap is the one that
 * grabs the Pin.
 *
 * Deliberately not wrapping `SafeAreaView` too: screens differ in which edges
 * they inset, and a couple render this in more than one branch.
 *
 * The ref goes to the inner `ScrollView`, not the wrapper — `PlantDetailScreen`
 * scrolls itself back to the top when a Save fails, which was its own #18 QA
 * finding, and swallowing the ref here would have quietly undone it.
 */
export const KeyboardAwareScrollView = forwardRef<
  ScrollView,
  ScrollViewProps & { children?: ReactNode }
>(function KeyboardAwareScrollView({ children, ...scrollViewProps }, ref) {
  return (
    <KeyboardAvoidingView
      style={styles.filler}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView ref={ref} keyboardShouldPersistTaps="handled" {...scrollViewProps}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  )
})

const styles = StyleSheet.create({
  filler: {
    flex: 1,
  },
})
