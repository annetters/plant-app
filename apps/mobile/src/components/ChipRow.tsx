import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

/** A horizontal-scrolling row of selectable filter chips, with a leading "Any" chip for the unfiltered/cleared state. Tapping the selected chip again clears it back to "Any". */
export function ChipRow({
  label,
  options,
  selected,
  onSelect,
  formatChip,
}: {
  label: string
  options: readonly string[]
  selected: string
  onSelect: (value: string) => void
  formatChip: (value: string) => string
}) {
  return (
    <View style={styles.filterRow}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chipRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: selected === '' }}
            style={[styles.chip, selected === '' && styles.chipSelected]}
            onPress={() => onSelect('')}
          >
            <Text style={selected === '' ? styles.chipTextSelected : styles.chipText}>Any</Text>
          </Pressable>
          {options.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: selected === option }}
              style={[styles.chip, selected === option && styles.chipSelected]}
              onPress={() => onSelect(selected === option ? '' : option)}
            >
              <Text style={selected === option ? styles.chipTextSelected : styles.chipText}>
                {formatChip(option)}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  filterRow: {
    gap: 4,
  },
  filterLabel: {
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipSelected: {
    borderColor: '#2e7d32',
    backgroundColor: '#e8f5e9',
  },
  chipText: {
    color: '#333',
  },
  chipTextSelected: {
    color: '#2e7d32',
    fontWeight: '600',
  },
})
