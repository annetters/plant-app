import type {
  Bed,
  FoliageType,
  NativeStatus,
  Plant,
  Planting,
  RegistryFilters,
  SunRequirement,
} from '@plant-app/domain'
import {
  FOLIAGE_TYPES,
  MONTH_NAMES,
  NATIVE_STATUSES,
  SUN_REQUIREMENTS,
  filterRegistryEntries,
  formatMonthDay,
  formatOption,
  plantLabel,
} from '@plant-app/domain'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { MainStackParamList } from '../navigation/types'
import { usePlantsRepository } from '../plants/PlantsRepositoryContext'
import { usePlantingsRepository } from '../plantings/PlantingsRepositoryContext'
import { useBedsRepository } from '../property/BedsRepositoryContext'
import { usePropertiesRepository } from '../property/PropertiesRepositoryContext'

/**
 * Registry (#16, native counterpart of #10 — see CONTEXT.md): the same
 * searchable/filterable Plant list as the web Registry, `filterRegistryEntries`
 * doing the actual work across every combined axis. Beds/Plantings are
 * fetched only to show each entry's Planting location(s); a failure loading
 * them doesn't block the primary Plant list, same reasoning as the web page.
 *
 * There is no native Map screen yet (#14 is still unbuilt) for a Planting
 * location to jump to, so unlike web's `Link to /map?plantingId=`, this
 * shows the Bed name as plain text rather than fake a navigation target
 * that doesn't exist yet.
 */
function plantAttributeLines(plant: Plant): string[] {
  const lines: string[] = []
  if (plant.flowerColor) lines.push(`Flower color: ${plant.flowerColor}`)
  if (plant.bloomWindow) {
    lines.push(`Blooms: ${formatMonthDay(plant.bloomWindow.start)} – ${formatMonthDay(plant.bloomWindow.end)}`)
  }
  if (plant.sunRequirement) lines.push(`Sun: ${formatOption(plant.sunRequirement)}`)
  if (plant.foliageType) lines.push(`Foliage: ${formatOption(plant.foliageType)}`)
  if (plant.nativeStatus) lines.push(`Native status: ${formatOption(plant.nativeStatus)}`)
  return lines
}

function ChipRow({
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

const MONTH_OPTIONS = MONTH_NAMES.map((_, index) => String(index + 1))

export function RegistryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const plantsRepository = usePlantsRepository()
  const propertiesRepository = usePropertiesRepository()
  const bedsRepository = useBedsRepository()
  const plantingsRepository = usePlantingsRepository()

  const [plants, setPlants] = useState<Plant[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [beds, setBeds] = useState<Bed[]>([])
  const [plantings, setPlantings] = useState<Planting[]>([])

  const [search, setSearch] = useState('')
  const [flowerColor, setFlowerColor] = useState('')
  const [bloomMonth, setBloomMonth] = useState('')
  const [sunRequirement, setSunRequirement] = useState('')
  const [foliageType, setFoliageType] = useState('')
  const [nativeStatus, setNativeStatus] = useState('')

  useEffect(() => {
    let cancelled = false
    plantsRepository
      .list()
      .then((result) => {
        if (!cancelled) setPlants(result)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your plants. Please try again.')
      })
    return () => {
      cancelled = true
    }
  }, [plantsRepository])

  useEffect(() => {
    let cancelled = false
    propertiesRepository
      .get()
      .then((property) => {
        if (cancelled || !property) return undefined
        return bedsRepository.list(property.id).then((result) => {
          if (!cancelled) setBeds(result)
        })
      })
      .catch(() => {
        // Planting-location info is a nice-to-have on top of the primary
        // Plant list — a failure loading the Property/Beds shouldn't block
        // search/filtering, which works from `plants` alone.
      })
    return () => {
      cancelled = true
    }
  }, [propertiesRepository, bedsRepository])

  useEffect(() => {
    if (beds.length === 0) {
      setPlantings([])
      return
    }
    let cancelled = false
    plantingsRepository
      .listByBeds(beds.map((bed) => bed.id))
      .then((result) => {
        if (!cancelled) setPlantings(result)
      })
      .catch(() => {
        // Same reasoning as the Beds fetch above — non-blocking.
      })
    return () => {
      cancelled = true
    }
  }, [beds, plantingsRepository])

  const filters: RegistryFilters = useMemo(
    () => ({
      ...(search !== '' && { search }),
      ...(flowerColor !== '' && { flowerColor }),
      ...(bloomMonth !== '' && { bloomMonth: Number(bloomMonth) }),
      ...(sunRequirement !== '' && { sunRequirement: sunRequirement as SunRequirement }),
      ...(foliageType !== '' && { foliageType: foliageType as FoliageType }),
      ...(nativeStatus !== '' && { nativeStatus: nativeStatus as NativeStatus }),
    }),
    [search, flowerColor, bloomMonth, sunRequirement, foliageType, nativeStatus],
  )

  const filteredPlants = useMemo(
    () => (plants ? filterRegistryEntries(plants, filters) : []),
    [plants, filters],
  )

  // Built once per Beds/Plantings load rather than re-scanned per rendered
  // Plant — see apps/web's PlantsPage for the same O(plants × plantings) concern.
  const plantingsByPlantId = useMemo(() => {
    const map = new Map<string, Planting[]>()
    for (const planting of plantings) {
      const existing = map.get(planting.plantId)
      if (existing) existing.push(planting)
      else map.set(planting.plantId, [planting])
    }
    return map
  }, [plantings])

  const bedsById = useMemo(() => new Map(beds.map((bed) => [bed.id, bed])), [beds])

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Registry</Text>
          <Pressable accessibilityRole="button" onPress={() => navigation.goBack()}>
            <Text style={styles.backLink}>Back to Dashboard</Text>
          </Pressable>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
        {plants === null && !error && <Text>Loading…</Text>}
        {plants && plants.length === 0 && <Text>No plants yet — add your first one.</Text>}

        {plants && plants.length > 0 && (
          <>
            <View style={styles.filters}>
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Search</Text>
                <TextInput
                  accessibilityLabel="Search"
                  style={styles.input}
                  placeholder="Name or cultivar"
                  value={search}
                  onChangeText={setSearch}
                  clearButtonMode="while-editing"
                />
              </View>

              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Flower color</Text>
                <TextInput
                  accessibilityLabel="Flower color"
                  style={styles.input}
                  value={flowerColor}
                  onChangeText={setFlowerColor}
                  clearButtonMode="while-editing"
                />
              </View>

              <ChipRow
                label="Bloom month"
                options={MONTH_OPTIONS}
                selected={bloomMonth}
                onSelect={setBloomMonth}
                formatChip={(value) => MONTH_NAMES[Number(value) - 1]}
              />

              <ChipRow
                label="Sun/shade"
                options={SUN_REQUIREMENTS}
                selected={sunRequirement}
                onSelect={setSunRequirement}
                formatChip={formatOption}
              />

              <ChipRow
                label="Foliage"
                options={FOLIAGE_TYPES}
                selected={foliageType}
                onSelect={setFoliageType}
                formatChip={formatOption}
              />

              <ChipRow
                label="Native status"
                options={NATIVE_STATUSES}
                selected={nativeStatus}
                onSelect={setNativeStatus}
                formatChip={formatOption}
              />
            </View>

            {filteredPlants.length === 0 && <Text>No Plants match these filters.</Text>}

            {filteredPlants.length > 0 && (
              <View style={styles.list}>
                {filteredPlants.map((plant) => {
                  const locations = plantingsByPlantId.get(plant.id) ?? []
                  const attributeLines = plantAttributeLines(plant)
                  return (
                    <View key={plant.id} style={styles.listItem}>
                      <Text style={styles.plantName}>
                        {plant.commonName} — <Text style={styles.scientificName}>{plant.scientificName}</Text>
                      </Text>
                      {attributeLines.length > 0 && (
                        <Text style={styles.attributes}>{attributeLines.join(' · ')}</Text>
                      )}
                      {locations.length > 0 && (
                        <View accessibilityLabel={`${plantLabel(plant)} Planting locations`}>
                          {locations.map((planting) => {
                            const bed = bedsById.get(planting.bedId)
                            return (
                              <Text key={planting.id} style={styles.location}>
                                In {bed?.name ?? 'Bed'}
                              </Text>
                            )
                          })}
                        </View>
                      )}
                    </View>
                  )
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: 24,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  backLink: {
    color: '#2e7d32',
  },
  error: {
    color: '#b00020',
  },
  filters: {
    gap: 12,
    marginBottom: 8,
  },
  filterRow: {
    gap: 4,
  },
  filterLabel: {
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
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
  list: {
    gap: 16,
  },
  listItem: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 12,
    gap: 4,
  },
  plantName: {
    fontSize: 16,
    fontWeight: '600',
  },
  scientificName: {
    fontStyle: 'italic',
    fontWeight: '400',
  },
  attributes: {
    color: '#666',
  },
  location: {
    color: '#2e7d32',
  },
})
