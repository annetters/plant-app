import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { PlantsRepositoryProvider } from '../plants/PlantsRepositoryContext'
import { PlantingsRepositoryProvider } from '../plantings/PlantingsRepositoryContext'
import { BedsRepositoryProvider } from '../property/BedsRepositoryContext'
import { PropertiesRepositoryProvider } from '../property/PropertiesRepositoryContext'
import { bedRow } from '../test/bedRowFixture'
import { createFakeBedsDbClient } from '../test/fakeBedsDbClient'
import { createFakePlantsDbClient } from '../test/fakePlantsDbClient'
import { createFakePlantingsDbClient } from '../test/fakePlantingsDbClient'
import { createFakePropertiesDbClient } from '../test/fakePropertiesDbClient'
import { plantRow } from '../test/plantRowFixture'
import { plantingRow } from '../test/plantingRowFixture'
import { propertyRow } from '../test/propertyRowFixture'
import { RegistryScreen } from './RegistryScreen'

const Stack = createNativeStackNavigator()

function renderRegistry({
  plantRows = [],
  bedRows = [],
  plantingRows = [],
  property = null,
}: {
  plantRows?: Parameters<typeof createFakePlantsDbClient>[0]
  bedRows?: Parameters<typeof createFakeBedsDbClient>[0]
  plantingRows?: Parameters<typeof createFakePlantingsDbClient>[0]
  property?: Parameters<typeof createFakePropertiesDbClient>[0]
} = {}) {
  const { client: plantsClient } = createFakePlantsDbClient(plantRows)
  const { client: bedsClient } = createFakeBedsDbClient(bedRows)
  const { client: plantingsClient } = createFakePlantingsDbClient(plantingRows)
  const { client: propertiesClient } = createFakePropertiesDbClient(property)

  return render(
    <PropertiesRepositoryProvider client={propertiesClient}>
      <BedsRepositoryProvider client={bedsClient}>
        <PlantingsRepositoryProvider client={plantingsClient}>
          <PlantsRepositoryProvider client={plantsClient}>
            <NavigationContainer>
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Registry" component={RegistryScreen} />
              </Stack.Navigator>
            </NavigationContainer>
          </PlantsRepositoryProvider>
        </PlantingsRepositoryProvider>
      </BedsRepositoryProvider>
    </PropertiesRepositoryProvider>,
  )
}

describe('RegistryScreen', () => {
  it('shows a message when the account has no Plants yet', async () => {
    await renderRegistry({ plantRows: [] })

    expect(await screen.findByText('No plants yet — add your first one.')).toBeTruthy()
  })

  it('lists every Plant with its matching attributes shown', async () => {
    await renderRegistry({
      plantRows: [
        plantRow({
          id: 'p1',
          common_name: 'Coneflower',
          scientific_name: 'Echinacea purpurea',
          flower_color: 'Purple',
          sun_requirement: 'full-sun',
        }),
      ],
    })

    expect(await screen.findByText(/Coneflower/)).toBeTruthy()
    expect(screen.getByText(/Echinacea purpurea/)).toBeTruthy()
    expect(screen.getByText(/Flower color: Purple/)).toBeTruthy()
    expect(screen.getByText(/Sun: full sun/)).toBeTruthy()
  })

  it('narrows the list by search, combined with an enum filter axis', async () => {
    await renderRegistry({
      plantRows: [
        plantRow({ id: 'p1', common_name: 'Coneflower', sun_requirement: 'full-sun' }),
        plantRow({ id: 'p2', common_name: 'Coral bells', sun_requirement: 'full-shade' }),
        plantRow({ id: 'p3', common_name: 'Zinnia', sun_requirement: 'full-sun' }),
      ],
    })
    await screen.findByText(/Coneflower/)

    await fireEvent.changeText(screen.getByLabelText('Search'), 'co')

    expect(screen.getByText(/Coneflower/)).toBeTruthy()
    expect(screen.getByText(/Coral bells/)).toBeTruthy()
    expect(screen.queryByText(/Zinnia/)).toBeNull()

    await fireEvent.press(screen.getByRole('button', { name: 'full sun' }))

    expect(screen.getByText(/Coneflower/)).toBeTruthy()
    expect(screen.queryByText(/Coral bells/)).toBeNull()

    await fireEvent.press(screen.getByRole('button', { name: 'full sun' }))
    await fireEvent.changeText(screen.getByLabelText('Search'), 'zzz')

    expect(await screen.findByText('No Plants match these filters.')).toBeTruthy()
  })

  it('shows a matched Plant\'s Planting location by Bed name', async () => {
    await renderRegistry({
      property: propertyRow({ id: 'property-1' }),
      bedRows: [bedRow({ id: 'bed-1', property_id: 'property-1', name: 'Front border' })],
      plantingRows: [plantingRow({ id: 'planting-1', plant_id: 'p1', bed_id: 'bed-1' })],
      plantRows: [plantRow({ id: 'p1', common_name: 'Coneflower' })],
    })

    expect(await screen.findByText('In Front border')).toBeTruthy()
  })

  it('shows an error if the Plant list fails to load', async () => {
    const failingClient = {
      from: () => ({
        select: () => ({
          order: () => Promise.reject(new Error('boom')),
        }),
      }),
    }
    await render(
      <PropertiesRepositoryProvider client={createFakePropertiesDbClient(null).client}>
        <BedsRepositoryProvider client={createFakeBedsDbClient([]).client}>
          <PlantingsRepositoryProvider client={createFakePlantingsDbClient([]).client}>
            <PlantsRepositoryProvider client={failingClient as never}>
              <NavigationContainer>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="Registry" component={RegistryScreen} />
                </Stack.Navigator>
              </NavigationContainer>
            </PlantsRepositoryProvider>
          </PlantingsRepositoryProvider>
        </BedsRepositoryProvider>
      </PropertiesRepositoryProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('Could not load your plants. Please try again.')).toBeTruthy()
    })
  })
})
