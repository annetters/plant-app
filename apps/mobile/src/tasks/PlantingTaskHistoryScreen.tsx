import {
  buildPlantingTaskHistory,
  plantLabel,
  validateTaskCompletionInput,
  type CareTaskTemplate,
  type Plant,
  type Planting,
  type TaskCompletion,
  type TaskCompletionStatus,
} from '@plant-app/domain'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { MainStackParamList } from '../navigation/types'
import { usePlantsRepository } from '../plants/PlantsRepositoryContext'
import { usePlantingsRepository } from '../plantings/PlantingsRepositoryContext'
import { useTaskCompletionsRepository } from './TaskCompletionsRepositoryContext'

/**
 * Phone parity for a Planting's reviewable care history (ticket #18, native
 * counterpart of web's `PlantingTaskHistoryPage`) — one row per Care task
 * template on its Plant, mark done/missed for a given calendar year.
 */
export function PlantingTaskHistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const route = useRoute<RouteProp<MainStackParamList, 'PlantingTaskHistory'>>()
  const { plantingId } = route.params
  const plantingsRepository = usePlantingsRepository()
  const plantsRepository = usePlantsRepository()
  const taskCompletionsRepository = useTaskCompletionsRepository()

  const [planting, setPlanting] = useState<Planting | null | undefined>(undefined)
  const [plant, setPlant] = useState<Plant | null>(null)
  const [templates, setTemplates] = useState<CareTaskTemplate[]>([])
  const [completions, setCompletions] = useState<TaskCompletion[]>([])
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [markError, setMarkError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    plantingsRepository
      .get(plantingId)
      .then((result) => {
        if (!cancelled) setPlanting(result)
      })
      .catch(() => {
        if (!cancelled) {
          setPlanting(null)
          setLoadError('Could not load this Planting.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [plantingId, plantingsRepository])

  useEffect(() => {
    if (!planting) return
    let cancelled = false
    plantsRepository
      .get(planting.plantId)
      .then((result) => {
        if (!cancelled) setPlant(result)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load this Planting’s Plant.')
      })
    plantsRepository
      .listCareTaskTemplates(planting.plantId)
      .then((result) => {
        if (!cancelled) setTemplates(result)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load this Plant’s Care task templates.')
      })
    return () => {
      cancelled = true
    }
  }, [planting, plantsRepository])

  useEffect(() => {
    let cancelled = false
    taskCompletionsRepository
      .listByPlanting(plantingId)
      .then((result) => {
        if (!cancelled) setCompletions(result)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load this Planting’s task history.')
      })
    return () => {
      cancelled = true
    }
  }, [plantingId, taskCompletionsRepository])

  async function handleMark(templateId: string, status: TaskCompletionStatus) {
    const yearNumber = Number(year)
    const input = { careTaskTemplateId: templateId, plantingId, year: yearNumber, status }
    const validation = validateTaskCompletionInput(input)
    if (!validation.ok) {
      setMarkError(Object.values(validation.errors)[0] ?? 'Could not record this task.')
      return
    }
    setMarkError(null)
    try {
      const recorded = await taskCompletionsRepository.record(input)
      setCompletions((current) => [
        ...current.filter((completion) => completion.id !== recorded.id),
        recorded,
      ])
    } catch (error) {
      setMarkError(error instanceof Error ? error.message : 'Could not record this task.')
    }
  }

  const history = useMemo(
    () => buildPlantingTaskHistory(templates, completions, planting?.id ?? '', Number(year)),
    [templates, completions, planting?.id, year],
  )

  if (planting === undefined) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Text style={styles.loading}>Loading…</Text>
      </SafeAreaView>
    )
  }

  if (planting === null) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.container}>
          {loadError && <Text style={styles.error}>{loadError}</Text>}
          <Text>This Planting could not be found.</Text>
          <Pressable accessibilityRole="button" onPress={() => navigation.goBack()}>
            <Text style={styles.backLink}>Back to Tasks &amp; To-dos</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{plantLabel(plant ?? undefined)} task history</Text>
          <Pressable accessibilityRole="button" onPress={() => navigation.goBack()}>
            <Text style={styles.backLink}>Back to Tasks &amp; To-dos</Text>
          </Pressable>
        </View>
        {loadError && <Text style={styles.error}>{loadError}</Text>}
        {markError && <Text style={styles.error}>{markError}</Text>}

        <View style={styles.field}>
          <Text style={styles.label}>Year</Text>
          <TextInput
            accessibilityLabel="Year"
            style={styles.input}
            keyboardType="number-pad"
            value={year}
            onChangeText={setYear}
          />
        </View>

        {templates.length === 0 ? (
          <Text>This Plant has no Care task templates yet.</Text>
        ) : (
          <View style={styles.historyList}>
            {history.map((entry) => (
              <View key={entry.careTaskTemplateId} style={styles.historyItem}>
                <Text style={styles.historyName}>{entry.careTaskTemplateName}</Text>
                <Text style={styles.historyStatus}>{entry.status}</Text>
                <View style={styles.historyActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: entry.status === 'done' }}
                    style={[styles.buttonSecondary, entry.status === 'done' && styles.buttonActive]}
                    disabled={entry.status === 'done'}
                    onPress={() => handleMark(entry.careTaskTemplateId, 'done')}
                  >
                    <Text style={entry.status === 'done' && styles.buttonActiveText}>Mark done</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: entry.status === 'missed' }}
                    style={[styles.buttonSecondary, entry.status === 'missed' && styles.buttonActive]}
                    disabled={entry.status === 'missed'}
                    onPress={() => handleMark(entry.careTaskTemplateId, 'missed')}
                  >
                    <Text style={entry.status === 'missed' && styles.buttonActiveText}>Mark missed</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loading: {
    padding: 24,
  },
  container: {
    flexGrow: 1,
    padding: 24,
    gap: 16,
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
    flexShrink: 1,
  },
  backLink: {
    color: '#2e7d32',
  },
  error: {
    color: '#b00020',
  },
  field: {
    gap: 4,
  },
  label: {
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
  },
  historyList: {
    gap: 12,
  },
  historyItem: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 12,
    gap: 8,
  },
  historyName: {
    fontWeight: '600',
  },
  historyStatus: {
    color: '#666',
  },
  historyActions: {
    flexDirection: 'row',
    gap: 8,
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: '#2e7d32',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  buttonActive: {
    backgroundColor: '#2e7d32',
  },
  buttonActiveText: {
    color: '#fff',
    fontWeight: '600',
  },
})
