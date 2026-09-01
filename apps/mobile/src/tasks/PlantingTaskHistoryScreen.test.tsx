import { NavigationContainer, useNavigation } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Pressable, Text } from 'react-native'
import { PlantsRepositoryProvider } from '../plants/PlantsRepositoryContext'
import { PlantingsRepositoryProvider } from '../plantings/PlantingsRepositoryContext'
import { careTaskTemplateRow } from '../test/careTaskTemplateRowFixture'
import { createFakePlantingsDbClient } from '../test/fakePlantingsDbClient'
import { createFakePlantsDbClient } from '../test/fakePlantsDbClient'
import { plantRow } from '../test/plantRowFixture'
import { plantingRow } from '../test/plantingRowFixture'
import { createFakeTaskCompletionsDbClient } from '../test/fakeTaskCompletionsDbClient'
import { PlantingTaskHistoryScreen } from './PlantingTaskHistoryScreen'
import { TaskCompletionsRepositoryProvider } from './TaskCompletionsRepositoryContext'

const Stack = createNativeStackNavigator()

function TasksStub() {
  const navigation = useNavigation<any>()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => navigation.navigate('PlantingTaskHistory', { plantingId: 'planting-1' })}
    >
      <Text>tasks screen</Text>
    </Pressable>
  )
}

async function renderScreen({
  plantingRows = [plantingRow({ id: 'planting-1', plant_id: 'plant-1' })],
  plantRows = [plantRow({ id: 'plant-1', common_name: 'Coneflower' })],
  templateRows = [] as Parameters<typeof createFakePlantsDbClient>[1],
  completionRows = [] as Parameters<typeof createFakeTaskCompletionsDbClient>[0],
} = {}) {
  const taskCompletionsFake = createFakeTaskCompletionsDbClient(completionRows)
  await render(
    <PlantingsRepositoryProvider client={createFakePlantingsDbClient(plantingRows).client}>
      <PlantsRepositoryProvider client={createFakePlantsDbClient(plantRows, templateRows).client}>
        <TaskCompletionsRepositoryProvider client={taskCompletionsFake.client}>
          <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Tasks" component={TasksStub} />
              <Stack.Screen name="PlantingTaskHistory" component={PlantingTaskHistoryScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </TaskCompletionsRepositoryProvider>
      </PlantsRepositoryProvider>
    </PlantingsRepositoryProvider>,
  )
  await fireEvent.press(screen.getByText('tasks screen'))
  return { taskCompletionsFake }
}

describe('PlantingTaskHistoryScreen', () => {
  it('shows one history row per Care task template, defaulting to pending', async () => {
    await renderScreen({
      templateRows: [careTaskTemplateRow({ id: 't1', plant_id: 'plant-1', name: 'Fertilize' })],
    })

    expect(await screen.findByText('Coneflower task history')).toBeTruthy()
    expect(screen.getByText('Fertilize')).toBeTruthy()
    expect(screen.getByText('pending')).toBeTruthy()
  })

  it('shows a message when the Plant has no Care task templates yet', async () => {
    await renderScreen()

    expect(await screen.findByText('This Plant has no Care task templates yet.')).toBeTruthy()
  })

  it('marks a task done for the current year', async () => {
    const { taskCompletionsFake } = await renderScreen({
      templateRows: [careTaskTemplateRow({ id: 't1', plant_id: 'plant-1', name: 'Fertilize' })],
    })
    await screen.findByText('Fertilize')

    await fireEvent.press(screen.getByRole('button', { name: 'Mark done' }))

    await waitFor(() => expect(screen.getByText('done')).toBeTruthy())
    expect(taskCompletionsFake.rows()).toHaveLength(1)
    expect(taskCompletionsFake.rows()[0].status).toBe('done')
  })

  it('re-marking a task updates the same row rather than duplicating it', async () => {
    const { taskCompletionsFake } = await renderScreen({
      templateRows: [careTaskTemplateRow({ id: 't1', plant_id: 'plant-1', name: 'Fertilize' })],
    })
    await screen.findByText('Fertilize')

    await fireEvent.press(screen.getByRole('button', { name: 'Mark done' }))
    await waitFor(() => expect(screen.getByText('done')).toBeTruthy())
    await fireEvent.press(screen.getByRole('button', { name: 'Mark missed' }))

    await waitFor(() => expect(screen.getByText('missed')).toBeTruthy())
    expect(taskCompletionsFake.rows()).toHaveLength(1)
  })
})
