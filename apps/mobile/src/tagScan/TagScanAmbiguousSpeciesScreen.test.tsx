import { NavigationContainer, useNavigation } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { useEffect } from 'react'
import { Text } from 'react-native'
import { TagScanAmbiguousSpeciesScreen } from './TagScanAmbiguousSpeciesScreen'

const Stack = createNativeStackNavigator()

const photoIds = { frontTagPhotoId: 'tag-photo-1' }

async function renderAmbiguousFlow() {
  await render(
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="TagScanAmbiguousSpecies"
          component={TagScanAmbiguousSpeciesScreen}
          initialParams={{
            scanId: 'scan-1',
            photoIds,
            candidate: { commonName: 'bee balm' },
            species: [
              { scientificName: 'Monarda didyma', commonName: 'bee balm' },
              { scientificName: 'Monarda fistulosa', commonName: 'bee balm' },
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

describe('TagScanAmbiguousSpeciesScreen', () => {
  it('lists every distinct species candidate and tells the user to check the physical tag', async () => {
    await renderAmbiguousFlow()

    expect(await screen.findByText('Monarda didyma')).toBeTruthy()
    expect(screen.getByText('Monarda fistulosa')).toBeTruthy()
    expect(screen.getByText(/Check the physical tag/)).toBeTruthy()
  })

  it('returns the picked species to Review, still unconfirmed, carrying the photo ids forward', async () => {
    await renderAmbiguousFlow()
    await waitFor(() => expect(screen.getByText('Monarda fistulosa')).toBeTruthy())

    await fireEvent.press(screen.getByText('Monarda fistulosa'))

    const reviewText = await screen.findByText(/review:/)
    const params = JSON.parse(reviewText.props.children.join('').replace('review: ', ''))
    expect(params.candidate).toEqual({
      commonName: 'bee balm',
      scientificName: 'Monarda fistulosa',
    })
    expect(params.photoIds).toEqual(photoIds)
  })

  it('lets the user leave the screen without picking any option, back to Review, when none of them match', async () => {
    function ReviewStandIn() {
      const navigation = useNavigation<any>()
      useEffect(() => {
        navigation.navigate('TagScanAmbiguousSpecies', {
          scanId: 'scan-1',
          photoIds,
          candidate: { commonName: 'bee balm' },
          species: [
            { scientificName: 'Monarda didyma', commonName: 'bee balm' },
            { scientificName: 'Monarda fistulosa', commonName: 'bee balm' },
          ],
        })
      }, [navigation])
      return <Text>back on review</Text>
    }

    await render(
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="TagScanReview" component={ReviewStandIn} />
          <Stack.Screen name="TagScanAmbiguousSpecies" component={TagScanAmbiguousSpeciesScreen} />
        </Stack.Navigator>
      </NavigationContainer>,
    )

    await waitFor(() => expect(screen.getByText('Monarda fistulosa')).toBeTruthy())

    await fireEvent.press(screen.getByText('Go back and edit'))

    expect(await screen.findByText('back on review')).toBeTruthy()
  })
})
