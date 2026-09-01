import { plantLabel, validateOneOffTodoInput, type Bed, type OneOffTodo, type Plant, type Planting, type Property } from '@plant-app/domain'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { MainStackParamList } from '../navigation/types'
import { usePlantsRepository } from '../plants/PlantsRepositoryContext'
import { usePlantingsRepository } from '../plantings/PlantingsRepositoryContext'
import { useBedsRepository } from '../property/BedsRepositoryContext'
import { usePropertiesRepository } from '../property/PropertiesRepositoryContext'
import { useOneOffTodosRepository } from './OneOffTodosRepositoryContext'

/**
 * Phone parity for the Task/todo hub (ticket #18, native counterpart of
 * web's `TasksPage`) — a Planting's task history is one hop away (via its
 * own screen), plus one-off todos live here directly. Reachable from the
 * Dashboard via a plain link, not a tile — see CONTEXT.md's Dashboard entry
 * ("Task lists not surfaced immediately").
 */
export function TasksScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const propertiesRepository = usePropertiesRepository()
  const bedsRepository = useBedsRepository()
  const plantingsRepository = usePlantingsRepository()
  const plantsRepository = usePlantsRepository()
  const oneOffTodosRepository = useOneOffTodosRepository()

  const [property, setProperty] = useState<Property | null | undefined>(undefined)
  const [beds, setBeds] = useState<Bed[]>([])
  const [plantings, setPlantings] = useState<Planting[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const [todos, setTodos] = useState<OneOffTodo[]>([])
  const [todoText, setTodoText] = useState('')
  const [todoError, setTodoError] = useState<string | null>(null)
  const [savingTodo, setSavingTodo] = useState(false)

  useEffect(() => {
    let cancelled = false
    propertiesRepository
      .get()
      .then((result) => {
        if (!cancelled) setProperty(result)
      })
      .catch(() => {
        if (!cancelled) {
          setProperty(null)
          setLoadError('Could not load your Property.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [propertiesRepository])

  useEffect(() => {
    if (!property) return
    let cancelled = false
    bedsRepository
      .list(property.id)
      .then((result) => {
        if (!cancelled) setBeds(result)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load your Beds.')
      })
    return () => {
      cancelled = true
    }
  }, [property, bedsRepository])

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
        if (!cancelled) setLoadError('Could not load your Plantings.')
      })
    return () => {
      cancelled = true
    }
  }, [beds, plantingsRepository])

  useEffect(() => {
    let cancelled = false
    plantsRepository
      .list()
      .then((result) => {
        if (!cancelled) setPlants(result)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load your Plants.')
      })
    return () => {
      cancelled = true
    }
  }, [plantsRepository])

  useEffect(() => {
    let cancelled = false
    oneOffTodosRepository
      .list()
      .then((result) => {
        if (!cancelled) setTodos(result)
      })
      .catch(() => {
        if (!cancelled) setTodoError('Could not load your to-dos.')
      })
    return () => {
      cancelled = true
    }
  }, [oneOffTodosRepository])

  async function handleAddTodo() {
    const input = { text: todoText }
    const validation = validateOneOffTodoInput(input)
    if (!validation.ok) {
      setTodoError(Object.values(validation.errors)[0] ?? 'Could not add this to-do.')
      return
    }
    setTodoError(null)
    setSavingTodo(true)
    try {
      const created = await oneOffTodosRepository.create(input)
      setTodos((current) => [...current, created])
      setTodoText('')
    } catch (error) {
      setTodoError(error instanceof Error ? error.message : 'Could not add this to-do.')
    } finally {
      setSavingTodo(false)
    }
  }

  async function handleToggleTodo(todo: OneOffTodo) {
    try {
      const updated = await oneOffTodosRepository.setDone(todo.id, !todo.done)
      setTodos((current) => current.map((t) => (t.id === updated.id ? updated : t)))
    } catch {
      setTodoError('Could not update this to-do.')
    }
  }

  async function handleRemoveTodo(id: string) {
    try {
      await oneOffTodosRepository.remove(id)
      setTodos((current) => current.filter((t) => t.id !== id))
    } catch {
      setTodoError('Could not remove this to-do.')
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Tasks &amp; To-dos</Text>
          <Pressable accessibilityRole="button" onPress={() => navigation.goBack()}>
            <Text style={styles.backLink}>Back to Dashboard</Text>
          </Pressable>
        </View>
        {loadError && <Text style={styles.error}>{loadError}</Text>}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>One-off to-dos</Text>
          {todoError && <Text style={styles.error}>{todoError}</Text>}
          <View style={styles.todoList}>
            {todos.map((todo) => (
              <View key={todo.id} style={styles.todoItem}>
                {/* A checkbox, not a Switch — "on/off" reads as a setting,
                    while a to-do is something you check off a list, never
                    toggled back "on" in the same sense. Matches web's own
                    <input type="checkbox">. RN has no built-in checkbox, so
                    this is a small Pressable standing in for one rather than
                    pulling in a dependency for it. */}
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: todo.done }}
                  accessibilityLabel={`Mark done: ${todo.text}`}
                  style={styles.checkbox}
                  onPress={() => handleToggleTodo(todo)}
                >
                  {todo.done && <Text style={styles.checkboxMark}>✓</Text>}
                </Pressable>
                <Text style={[styles.todoText, todo.done && styles.todoTextDone]}>{todo.text}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove to-do: ${todo.text}`}
                  onPress={() => handleRemoveTodo(todo.id)}
                >
                  <Text style={styles.removeLink}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>

          <View style={styles.addTodoRow}>
            <TextInput
              accessibilityLabel="Add a to-do"
              style={styles.input}
              value={todoText}
              onChangeText={setTodoText}
              placeholder="Add a to-do"
            />
            <Pressable
              accessibilityRole="button"
              style={styles.addButton}
              disabled={savingTodo}
              onPress={handleAddTodo}
            >
              <Text style={styles.addButtonText}>{savingTodo ? 'Adding…' : 'Add'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Plantings</Text>
          {property === null && <Text>Set up your Property to start tracking Planting tasks.</Text>}
          {plantings.length === 0 && property && <Text>No Plantings yet.</Text>}
          <View style={styles.plantingList}>
            {plantings.map((planting) => {
              const plant = plants.find((p) => p.id === planting.plantId)
              return (
                <Pressable
                  key={planting.id}
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('PlantingTaskHistory', { plantingId: planting.id })}
                >
                  <Text style={styles.plantingLink}>{plantLabel(plant)} task history</Text>
                </Pressable>
              )
            })}
          </View>
        </View>
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
  },
  backLink: {
    color: '#2e7d32',
  },
  error: {
    color: '#b00020',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  todoList: {
    gap: 8,
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: '#2e7d32',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxMark: {
    color: '#2e7d32',
    fontWeight: '700',
  },
  todoText: {
    flex: 1,
  },
  todoTextDone: {
    textDecorationLine: 'line-through',
    color: '#666',
  },
  removeLink: {
    color: '#b00020',
  },
  addTodoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
  },
  addButton: {
    backgroundColor: '#2e7d32',
    borderRadius: 4,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
  },
  plantingList: {
    gap: 8,
  },
  plantingLink: {
    color: '#2e7d32',
  },
})
