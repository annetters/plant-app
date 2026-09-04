import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { STAGE_SIZE_PX } from '@plant-app/domain'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'
import { createFakePropertiesDbClient } from '../test/fakePropertiesDbClient'
import { propertyRow } from '../test/propertyRowFixture'
import { BaseMapSetupScreen } from './BaseMapSetupScreen'
import { PropertiesRepositoryProvider } from './PropertiesRepositoryContext'

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}))

// pickPhoto() re-encodes every picked photo to JPEG — see pickPhoto.test.ts
// for coverage of that conversion itself. Here it's a pass-through so these
// screen-level tests aren't coupled to expo-image-manipulator's API shape.
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: {
    manipulate: jest.fn((uri: string) => ({
      renderAsync: () => Promise.resolve({ saveAsync: () => Promise.resolve({ uri }) }),
    })),
  },
  SaveFormat: { JPEG: 'jpeg' },
}))

jest.mock('expo-crypto', () => {
  let next = 0
  return { randomUUID: jest.fn(() => `uuid-${++next}`) }
})

import * as ImagePicker from 'expo-image-picker'

const requestCamera = ImagePicker.requestCameraPermissionsAsync as jest.Mock
const requestLibrary = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock
const launchCamera = ImagePicker.launchCameraAsync as jest.Mock
const launchLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock

const Stack = createNativeStackNavigator()

async function renderScreen(fake: ReturnType<typeof createFakePropertiesDbClient>) {
  return await render(
    <PropertiesRepositoryProvider client={fake.client}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="BaseMapSetup" component={BaseMapSetupScreen} />
          <Stack.Screen name="Map">{() => <Text>Map screen</Text>}</Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </PropertiesRepositoryProvider>,
  )
}

/** The surface is laid out at the phone's width, so taps are in screen pixels and get converted back through the display scale. */
async function tapSurface(x: number, y: number) {
  await fireEvent.press(screen.getByTestId('scale-reference-surface'), {
    nativeEvent: { locationX: x, locationY: y },
  })
}

function displayScale(): number {
  return Number(screen.getByTestId('scale-reference-overlay').props.width) / STAGE_SIZE_PX
}

async function pickAPhoto() {
  requestLibrary.mockResolvedValue({ granted: true })
  launchLibrary.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///tmp/plan.heic', fileName: 'plan.heic', mimeType: 'image/heic' }],
  })
  await fireEvent.press(screen.getByText('Choose from library'))
  await waitFor(() => expect(screen.getByText('Continue to Scale Reference')).toBeTruthy())
  await fireEvent.press(screen.getByText('Continue to Scale Reference'))
  await waitFor(() => expect(screen.getByTestId('scale-reference-surface')).toBeTruthy())
}

beforeEach(() => {
  jest.clearAllMocks()
  globalThis.fetch = jest.fn().mockResolvedValue({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  }) as unknown as typeof fetch
})

describe('BaseMapSetupScreen — creating a Property from a photo', () => {
  it('takes a name, a photo and two calibrated points, and saves them as one Property', async () => {
    const fake = createFakePropertiesDbClient(null)
    await renderScreen(fake)

    await waitFor(() => expect(screen.getByLabelText('Name your map')).toBeTruthy())
    await fireEvent.changeText(screen.getByLabelText('Name your map'), 'Back garden')
    await fireEvent.press(screen.getByText('Continue'))

    await pickAPhoto()
    const scale = displayScale()

    await tapSurface(0, 0)
    await tapSurface(100 * scale, 0)
    await fireEvent.changeText(screen.getByLabelText('Real-world distance (feet)'), '25')
    await fireEvent.press(screen.getByText('Save Scale Reference'))

    await waitFor(() => expect(fake.row()).not.toBeNull())
    expect(fake.row()).toMatchObject({
      name: 'Back garden',
      address: null,
      base_map_source: 'photo',
      base_map_drawing: null,
      scale_reference: {
        pointA: { x: 0, y: 0 },
        pointB: { x: 100, y: 0 },
        realDistanceFeet: 25,
        mode: 'known-measurement',
      },
    })
  })

  it('files the photo under the same id the Property is then created with', async () => {
    const fake = createFakePropertiesDbClient(null)
    await renderScreen(fake)

    await waitFor(() => expect(screen.getByLabelText('Name your map')).toBeTruthy())
    await fireEvent.changeText(screen.getByLabelText('Name your map'), 'Back garden')
    await fireEvent.press(screen.getByText('Continue'))
    await pickAPhoto()

    const scale = displayScale()
    await tapSurface(0, 0)
    await tapSurface(100 * scale, 0)
    await fireEvent.changeText(screen.getByLabelText('Real-world distance (feet)'), '25')
    await fireEvent.press(screen.getByText('Save Scale Reference'))

    await waitFor(() => expect(fake.row()).not.toBeNull())
    const row = fake.row()!
    expect(row.base_map_photo_path).toBe(fake.storage.upload.mock.calls[0][0])
    expect(row.base_map_photo_path).toContain(`/${row.id}/`)
  })

  it('records the measured-object mode when that is what the gardener used', async () => {
    const fake = createFakePropertiesDbClient(null)
    await renderScreen(fake)

    await waitFor(() => expect(screen.getByLabelText('Name your map')).toBeTruthy())
    await fireEvent.changeText(screen.getByLabelText('Name your map'), 'Back garden')
    await fireEvent.press(screen.getByText('Continue'))
    await pickAPhoto()

    const scale = displayScale()
    await tapSurface(0, 0)
    await tapSurface(100 * scale, 0)
    await fireEvent.press(screen.getByText('Measured object'))
    await fireEvent.changeText(screen.getByLabelText('Real-world distance (feet)'), '40')
    await fireEvent.press(screen.getByText('Save Scale Reference'))

    await waitFor(() => expect(fake.row()).not.toBeNull())
    expect(fake.row()).toMatchObject({
      scale_reference: { mode: 'measured-object', realDistanceFeet: 40 },
    })
  })
})

describe('BaseMapSetupScreen — completing an aerial Property with no imagery', () => {
  it('updates the existing Property rather than creating a second one, and never asks for a name', async () => {
    const fake = createFakePropertiesDbClient(
      propertyRow({ id: 'property-1', base_map_source: 'aerial', name: null }),
    )
    await renderScreen(fake)

    await waitFor(() => expect(screen.getByText('Choose from library')).toBeTruthy())
    expect(screen.queryByLabelText('Name your map')).toBeNull()

    await pickAPhoto()
    const scale = displayScale()
    await tapSurface(0, 0)
    await tapSurface(0, 200 * scale)
    await fireEvent.changeText(screen.getByLabelText('Real-world distance (feet)'), '50')
    await fireEvent.press(screen.getByText('Save Scale Reference'))

    await waitFor(() =>
      expect(fake.row()).toMatchObject({ id: 'property-1', base_map_source: 'photo' }),
    )
    expect(fake.row()).toMatchObject({
      scale_reference: { pointA: { x: 0, y: 0 }, pointB: { x: 0, y: 200 }, realDistanceFeet: 50 },
    })
  })
})

describe('BaseMapSetupScreen — refusing to save something uncalibrated', () => {
  async function reachCalibration() {
    const fake = createFakePropertiesDbClient(
      propertyRow({ id: 'property-1', base_map_source: 'aerial' }),
    )
    await renderScreen(fake)
    await waitFor(() => expect(screen.getByText('Choose from library')).toBeTruthy())
    await pickAPhoto()
    return fake
  }

  it('does not ask about the distance until there are two points for it to be about', async () => {
    await reachCalibration()

    expect(screen.getByText('Tap the first point to begin.')).toBeTruthy()
    expect(screen.queryByText('How do you know this distance?')).toBeNull()
    expect(screen.queryByLabelText('Real-world distance (feet)')).toBeNull()
    expect(screen.queryByText('Save Scale Reference')).toBeNull()

    await tapSurface(0, 0)

    expect(screen.getByText(/Now tap the second point/)).toBeTruthy()
    expect(screen.queryByText('How do you know this distance?')).toBeNull()
    expect(screen.queryByText('Save Scale Reference')).toBeNull()

    await tapSurface(100 * displayScale(), 0)

    expect(screen.getByText('How do you know this distance?')).toBeTruthy()
    expect(screen.getByLabelText('Real-world distance (feet)')).toBeTruthy()
    expect(screen.getByText('Save Scale Reference')).toBeTruthy()
  })

  it('rejects a zero distance through the shared domain validation', async () => {
    const fake = await reachCalibration()

    const scale = displayScale()
    await tapSurface(0, 0)
    await tapSurface(100 * scale, 0)
    await fireEvent.changeText(screen.getByLabelText('Real-world distance (feet)'), '0')
    await fireEvent.press(screen.getByText('Save Scale Reference'))

    await waitFor(() =>
      expect(screen.getByText('Enter a real-world distance greater than 0.')).toBeTruthy(),
    )
    expect(fake.row()).toMatchObject({ base_map_source: 'aerial' })
  })

  it('rejects two points too close together to derive a usable scale', async () => {
    const fake = await reachCalibration()

    await tapSurface(0, 0)
    await tapSurface(0, 0)
    await fireEvent.changeText(screen.getByLabelText('Real-world distance (feet)'), '25')
    await fireEvent.press(screen.getByText('Save Scale Reference'))

    await waitFor(() =>
      expect(screen.getByText('Pick two distinct points, not the same spot twice.')).toBeTruthy(),
    )
    expect(fake.row()).toMatchObject({ base_map_source: 'aerial' })
  })

  it('restarts the pair on a third tap, so a misplaced point can be corrected', async () => {
    const fake = await reachCalibration()
    const scale = displayScale()

    await tapSurface(0, 0)
    await tapSurface(10 * scale, 0)
    await tapSurface(300 * scale, 0)
    // Back to one point, so the distance question withdraws until the pair is
    // complete again — otherwise a half-restarted pair would still show a
    // Save button for the previous one.
    expect(screen.queryByText('Save Scale Reference')).toBeNull()
    await tapSurface(500 * scale, 0)
    await fireEvent.changeText(screen.getByLabelText('Real-world distance (feet)'), '25')
    await fireEvent.press(screen.getByText('Save Scale Reference'))

    await waitFor(() => expect(fake.row()).toMatchObject({ base_map_source: 'photo' }))
    expect(fake.row()).toMatchObject({
      scale_reference: { pointA: { x: 300, y: 0 }, pointB: { x: 500, y: 0 } },
    })
  })
})

describe('BaseMapSetupScreen — when things go wrong', () => {
  it('reports a failed upload and stays on the photo step', async () => {
    const fake = createFakePropertiesDbClient(
      propertyRow({ id: 'property-1', base_map_source: 'aerial' }),
    )
    fake.storage.upload.mockResolvedValueOnce({ data: null, error: { message: 'denied' } })
    await renderScreen(fake)

    await waitFor(() => expect(screen.getByText('Choose from library')).toBeTruthy())
    requestLibrary.mockResolvedValue({ granted: true })
    launchLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/plan.heic', fileName: 'plan.heic', mimeType: 'image/heic' }],
    })
    await fireEvent.press(screen.getByText('Choose from library'))

    await waitFor(() =>
      expect(screen.getByText('Could not upload this photo. Please try again.')).toBeTruthy(),
    )
    expect(screen.queryByTestId('scale-reference-surface')).toBeNull()
    expect(screen.queryByText('Continue to Scale Reference')).toBeNull()
  })

  it('lets a blurry plan be replaced before any calibration is done', async () => {
    const fake = createFakePropertiesDbClient(
      propertyRow({ id: 'property-1', base_map_source: 'aerial' }),
    )
    await renderScreen(fake)
    await waitFor(() => expect(screen.getByText('Choose from library')).toBeTruthy())

    requestLibrary.mockResolvedValue({ granted: true })
    launchLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/blurry.heic', fileName: 'blurry.heic', mimeType: 'image/heic' }],
    })
    await fireEvent.press(screen.getByText('Choose from library'))
    await waitFor(() => expect(screen.getByText('Continue to Scale Reference')).toBeTruthy())

    launchLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/sharp.heic', fileName: 'sharp.heic', mimeType: 'image/heic' }],
    })
    await fireEvent.press(screen.getByText('Choose a different photo'))
    await waitFor(() => expect(fake.storage.upload).toHaveBeenCalledTimes(2))

    await fireEvent.press(screen.getByText('Continue to Scale Reference'))
    const scale = displayScale()
    await tapSurface(0, 0)
    await tapSurface(100 * scale, 0)
    await fireEvent.changeText(screen.getByLabelText('Real-world distance (feet)'), '25')
    await fireEvent.press(screen.getByText('Save Scale Reference'))

    // The second photo is the one calibrated, so it must be the one saved.
    await waitFor(() => expect(fake.row()).toMatchObject({ base_map_source: 'photo' }))
    expect(fake.row()!.base_map_photo_path).toBe(fake.storage.upload.mock.calls[1][0])
  })

  it('reports a denied camera permission without leaving the photo step', async () => {
    const fake = createFakePropertiesDbClient(
      propertyRow({ id: 'property-1', base_map_source: 'aerial' }),
    )
    await renderScreen(fake)

    await waitFor(() => expect(screen.getByText('Take a photo')).toBeTruthy())
    requestCamera.mockResolvedValue({ granted: false })
    await fireEvent.press(screen.getByText('Take a photo'))

    await waitFor(() =>
      expect(screen.getByText('Camera access is required to take a photo.')).toBeTruthy(),
    )
    expect(launchCamera).not.toHaveBeenCalled()
  })

  it('surfaces a failed save without losing the calibration work', async () => {
    const fake = createFakePropertiesDbClient(
      propertyRow({ id: 'property-1', base_map_source: 'aerial' }),
    )
    await renderScreen(fake)
    await waitFor(() => expect(screen.getByText('Choose from library')).toBeTruthy())
    await pickAPhoto()

    fake.failNextWrite({ message: 'boom' })
    const scale = displayScale()
    await tapSurface(0, 0)
    await tapSurface(100 * scale, 0)
    await fireEvent.changeText(screen.getByLabelText('Real-world distance (feet)'), '25')
    await fireEvent.press(screen.getByText('Save Scale Reference'))

    await waitFor(() => expect(screen.getByText('boom')).toBeTruthy())
    expect(screen.getByLabelText('Real-world distance (feet)').props.value).toBe('25')
  })

  it('refuses to rewrite a base map that is already a drawn plan, rather than discarding it', async () => {
    const fake = createFakePropertiesDbClient(
      propertyRow({ id: 'property-1', base_map_source: 'drawn', base_map_drawing: [] }),
    )
    await renderScreen(fake)

    await waitFor(() =>
      expect(screen.getByText(/already has a drawn base map/)).toBeTruthy(),
    )
    expect(screen.queryByText('Choose from library')).toBeNull()
    expect(screen.queryByText('Take a photo')).toBeNull()
  })

  it('does not offer to create a second Property when the existing one could not be loaded', async () => {
    const fake = createFakePropertiesDbClient(null)
    fake.client.from = () => {
      throw new Error('network down')
    }
    await renderScreen(fake)

    await waitFor(() =>
      expect(
        screen.getByText('Could not check whether you already have a Property. Go back and try again.'),
      ).toBeTruthy(),
    )
    expect(screen.queryByLabelText('Name your map')).toBeNull()
    expect(screen.queryByText('Choose from library')).toBeNull()
  })
})
