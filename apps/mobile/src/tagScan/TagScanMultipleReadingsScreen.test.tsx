import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { TagScanMultipleReadingsScreen } from './TagScanMultipleReadingsScreen'

const Stack = createNativeStackNavigator()

const photoIds = { frontTagPhotoId: 'tag-photo-1' }

async function renderMultipleReadingsFlow() {
  await render(
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="TagScanMultipleReadings"
          component={TagScanMultipleReadingsScreen}
          initialParams={{
            scanId: 'scan-1',
            photoIds,
            candidates: [
              { scientificName: 'Monarda didyma', cultivar: 'Pardon My Pink' },
              { scientificName: 'Veronica spicata' },
            ],
          }}
        />
        <Stack.Screen name="TagScanReview">
          {({ route }: any) => <Text>review: {JSON.stringify(route.params)}</Text>}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>,
  )
}

describe('TagScanMultipleReadingsScreen', () => {
  it('lists every distinct reading found on the photo', async () => {
    await renderMultipleReadingsFlow()

    expect(await screen.findByText('Monarda didyma')).toBeTruthy()
    expect(screen.getByText("'Pardon My Pink'")).toBeTruthy()
    expect(screen.getByText('Veronica spicata')).toBeTruthy()
  })

  it('sends the picked reading to Review, carrying the photo ids forward', async () => {
    await renderMultipleReadingsFlow()
    await screen.findByText('Veronica spicata')

    await fireEvent.press(screen.getByText('Veronica spicata'))

    const reviewText = await screen.findByText(/review:/)
    const params = JSON.parse(reviewText.props.children.join('').replace('review: ', ''))
    expect(params.candidate).toEqual({ scientificName: 'Veronica spicata' })
    expect(params.photoIds).toEqual(photoIds)
  })

  it('lets the user reject every reading and enter manually instead', async () => {
    await renderMultipleReadingsFlow()
    await screen.findByText('Monarda didyma')

    await fireEvent.press(screen.getByText('None of these — enter manually'))

    const reviewText = await screen.findByText(/review:/)
    const params = JSON.parse(reviewText.props.children.join('').replace('review: ', ''))
    expect(params.candidate).toBeUndefined()
  })
})
