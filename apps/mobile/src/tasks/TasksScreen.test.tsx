import { NavigationContainer, useNavigation, useRoute } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'
import { PlantsRepositoryProvider } from '../plants/PlantsRepositoryContext'
import { PlantingsRepositoryProvider } from '../plantings/PlantingsRepositoryContext'
import { BedsRepositoryProvider } from '../property/BedsRepositoryContext'
import { PropertiesRepositoryProvider } from '../property/PropertiesRepositoryContext'
import { bedRow } from '../test/bedRowFixture'
import { createFakeBedsDbClient } from '../test/fakeBedsDbClient'
import { createFakePlantingsDbClient } from '../test/fakePlantingsDbClient'
import { createFakePlantsDbClient } from '../test/fakePlantsDbClient'
import { createFakePropertiesDbClient } from '../test/fakePropertiesDbClient'
import { plantRow } from '../test/plantRowFixture'
import { plantingRow } from '../test/plantingRowFixture'
import { propertyRow } from '../test/propertyRowFixture'
import { createFakeOneOffTodosDbClient } from '../test/fakeOneOffTodosDbClient'
import { OneOffTodosRepositoryProvider } from './OneOffTodosRepositoryContext'
import { TasksScreen } from './TasksScreen'

const Stack = createNativeStackNavigator()

function PlantingTaskHistoryStub() {
  const route = useRoute<any>()
  return <Text>task history: {route.params.plantingId}</Text>
}

function DashboardStub() {
  const navigation = useNavigation<any>()
  return (
    <Text onPress={() => navigation.navigate('Tasks')} accessibilityRole="button">
      dashboard screen
    </Text>
  )
}

async function renderScreen({
  property = propertyRow({ id: 'property-1' }),
  bedRows = [] as ReturnType<typeof bedRow>[],
  plantingRows = [] as Parameters<typeof createFakePlantingsDbClient>[0],
  plantRows = [] as Parameters<typeof createFakePlantsDbClient>[0],
  todoRows = [] as Parameters<typeof createFakeOneOffTodosDbClient>[0],
} = {}) {
  const oneOffTodosFake = createFakeOneOffTodosDbClient(todoRows)
  await render(
    <PropertiesRepositoryProvider client={createFakePropertiesDbClient(property).client}>
      <BedsRepositoryProvider client={createFakeBedsDbClient(bedRows).client}>
        <PlantingsRepositoryProvider client={createFakePlantingsDbClient(plantingRows).client}>
          <PlantsRepositoryProvider client={createFakePlantsDbClient(plantRows).client}>
            <OneOffTodosRepositoryProvider client={oneOffTodosFake.client}>
              <NavigationContainer>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="Dashboard" component={DashboardStub} />
                  <Stack.Screen name="Tasks" component={TasksScreen} />
                  <Stack.Screen name="PlantingTaskHistory" component={PlantingTaskHistoryStub} />
                </Stack.Navigator>
              </NavigationContainer>
            </OneOffTodosRepositoryProvider>
          </PlantsRepositoryProvider>
        </PlantingsRepositoryProvider>
      </BedsRepositoryProvider>
    </PropertiesRepositoryProvider>,
  )
  await fireEvent.press(screen.getByText('dashboard screen'))
  return { oneOffTodosFake }
}

describe('TasksScreen', () => {
  it('lists each Planting linking to its own task history', async () => {
    await renderScreen({
      bedRows: [bedRow({ id: 'bed-1', property_id: 'property-1' })],
      plantingRows: [plantingRow({ id: 'planting-1', bed_id: 'bed-1', plant_id: 'plant-1' })],
      plantRows: [plantRow({ id: 'plant-1', common_name: 'Coneflower' })],
    })

    expect(await screen.findByText('Coneflower task history')).toBeTruthy()

    await fireEvent.press(screen.getByText('Coneflower task history'))

    expect(await screen.findByText('task history: planting-1')).toBeTruthy()
  })

  it('shows a message when there are no Plantings yet', async () => {
    await renderScreen()

    expect(await screen.findByText('No Plantings yet.')).toBeTruthy()
  })

  it('adds a one-off to-do', async () => {
    const { oneOffTodosFake } = await renderScreen()
    await screen.findByText('One-off to-dos')

    await fireEvent.changeText(screen.getByLabelText('Add a to-do'), 'Order mulch')
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(screen.getByText('Order mulch')).toBeTruthy())
    expect(oneOffTodosFake.rows()).toHaveLength(1)
  })

  it("renders a completed to-do's checkbox as checked, distinct from an on/off switch", async () => {
    await renderScreen({
      todoRows: [{ id: 'todo-1', text: 'Order mulch', done: true, created_at: '2026-01-01T00:00:00.000Z' }],
    })
    await screen.findByText('Order mulch')

    const checkbox = screen.getByRole('checkbox', { name: 'Mark done: Order mulch' })
    expect(checkbox.props.accessibilityState.checked).toBe(true)
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('toggles and removes a to-do', async () => {
    const { oneOffTodosFake } = await renderScreen({
      todoRows: [{ id: 'todo-1', text: 'Order mulch', done: false, created_at: '2026-01-01T00:00:00.000Z' }],
    })
    await screen.findByText('Order mulch')

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Mark done: Order mulch' }))
    await waitFor(() => expect(oneOffTodosFake.rows()[0].done).toBe(true))

    await fireEvent.press(screen.getByLabelText('Remove to-do: Order mulch'))
    await waitFor(() => expect(oneOffTodosFake.rows()).toHaveLength(0))
  })
})
