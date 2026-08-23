import { NavigationContainer, useNavigation } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Pressable, Text } from 'react-native'
import { createFakeTagScanDbClient } from '../test/fakeTagScanDbClient'
import { TagScanDuplicateOfferScreen } from './TagScanDuplicateOfferScreen'
import { TagScanRepositoryProvider } from './TagScanRepositoryContext'

const Stack = createNativeStackNavigator()

const existingPlant = {
  id: 'plant-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  commonName: 'Bee balm',
  scientificName: 'Monarda didyma',
  referencePhotoPaths: [],
}

const photoIds = { frontTagPhotoId: 'tag-photo-1' }

const duplicateOfferParams = {
  scanId: 'scan-1',
  photoIds,
  candidate: { commonName: 'Bee balm', scientificName: 'Monarda didyma' },
  existingPlant,
}

function StubReviewScreen() {
  const navigation = useNavigation<{ navigate: (name: string, params: unknown) => void }>()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => navigation.navigate('TagScanDuplicateOffer', duplicateOfferParams)}
    >
      <Text>review screen</Text>
    </Pressable>
  )
}

const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  }) as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

function defaultFakeClient() {
  return createFakeTagScanDbClient(
    [],
    [{ id: 'tag-photo-1', user_id: 'user-1', storage_path: 'user-1/scan-1/x.jpg' }],
  )
}

/** DuplicateOffer as the only/initial screen — for tests that don't exercise "go back". */
async function renderDuplicateFlow(fake = defaultFakeClient(), params = duplicateOfferParams) {
  await render(
    <TagScanRepositoryProvider client={fake.client}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen
            name="TagScanDuplicateOffer"
            component={TagScanDuplicateOfferScreen}
            initialParams={params}
          />
          <Stack.Screen name="Dashboard">{() => <Text>dashboard screen</Text>}</Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </TagScanRepositoryProvider>,
  )
  return fake
}

/** Review pushed first, so "go back" has somewhere real to land. */
async function renderDuplicateFlowViaReview(fake = defaultFakeClient()) {
  await render(
    <TagScanRepositoryProvider client={fake.client}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="TagScanReview">
          <Stack.Screen name="TagScanReview" component={StubReviewScreen} />
          <Stack.Screen name="TagScanDuplicateOffer" component={TagScanDuplicateOfferScreen} />
          <Stack.Screen name="Dashboard">{() => <Text>dashboard screen</Text>}</Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </TagScanRepositoryProvider>,
  )
  return fake
}

describe('TagScanDuplicateOfferScreen', () => {
  it('shows the existing Plant identity, not a duplicate-creation form', async () => {
    await renderDuplicateFlow()

    expect(await screen.findByText(/Bee balm \(Monarda didyma\)/)).toBeTruthy()
  })

  it('goes back to Review without creating anything when the user chooses to edit', async () => {
    const fake = await renderDuplicateFlowViaReview()
    await fireEvent.press(await screen.findByText('review screen'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Go back and edit' })).toBeTruthy())

    await fireEvent.press(screen.getByRole('button', { name: 'Go back and edit' }))

    expect(await screen.findByText('review screen')).toBeTruthy()
    expect(fake.plantRows()).toHaveLength(0)
  })

  it('creates a new Plant anyway when the user explicitly overrides the duplicate match, linking the tag photo', async () => {
    const fake = await renderDuplicateFlow()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: "This is actually different — create anyway" }),
      ).toBeTruthy(),
    )

    await fireEvent.press(
      screen.getByRole('button', { name: "This is actually different — create anyway" }),
    )

    expect(await screen.findByText('dashboard screen')).toBeTruthy()
    expect(fake.plantRows()).toEqual([
      expect.objectContaining({ common_name: 'Bee balm', scientific_name: 'Monarda didyma' }),
    ])
    expect(fake.tagPhotoRows()).toEqual([
      expect.objectContaining({ plant_id: fake.plantRows()[0].id }),
    ])
  })

  it('trims whitespace from the candidate before validating and saving', async () => {
    const fake = await renderDuplicateFlow(defaultFakeClient(), {
      ...duplicateOfferParams,
      candidate: { commonName: '  Bee balm  ', scientificName: '  Monarda didyma  ' },
    })
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: "This is actually different — create anyway" }),
      ).toBeTruthy(),
    )

    await fireEvent.press(
      screen.getByRole('button', { name: "This is actually different — create anyway" }),
    )

    expect(await screen.findByText('dashboard screen')).toBeTruthy()
    expect(fake.plantRows()[0]).toMatchObject({
      common_name: 'Bee balm',
      scientific_name: 'Monarda didyma',
    })
  })

  it('refuses to save an invalid candidate rather than bypassing validation', async () => {
    const fake = await renderDuplicateFlow(defaultFakeClient(), {
      ...duplicateOfferParams,
      candidate: { commonName: '000', scientificName: 'Monarda didyma' },
    })
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: "This is actually different — create anyway" }),
      ).toBeTruthy(),
    )

    await fireEvent.press(
      screen.getByRole('button', { name: "This is actually different — create anyway" }),
    )

    expect(await screen.findByText(/invalid/)).toBeTruthy()
    expect(fake.plantRows()).toHaveLength(0)
  })
})
