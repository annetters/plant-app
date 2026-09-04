import type { Property, ScalePoint, ScaleReferenceMode } from '@plant-app/domain'
import { STAGE_SIZE_PX, validateScaleReferenceInput } from '@plant-app/domain'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as Crypto from 'expo-crypto'
import { useEffect, useState } from 'react'
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Line, Rect } from 'react-native-svg'
import { KeyboardAwareScrollView } from '../components/KeyboardAwareScrollView'
import { pickPhoto, type PhotoSource, type PickedPhoto } from '../lib/pickPhoto'
import type { MainStackParamList } from '../navigation/types'
import { mapDisplayScale, tappedStagePoint } from './mapSurface'
import { usePropertiesRepository } from './PropertiesRepositoryContext'

const SCREEN_PADDING = 24
const POINT_RADIUS_PX = 7

type Step = 'name' | 'photo' | 'calibrate'

/**
 * Photograph a plot plan or survey and calibrate its Scale Reference, entirely
 * from the phone (ticket #15) — the native counterpart to web's
 * `BaseMapSetup`.
 *
 * ADR-0003 is the reason this exists on the phone at all: freehand/shape
 * *drawing* is desktop-only, but "Scale Reference calibration is not bundled
 * with 'drawing' ... It ships at full parity." So this screen offers the
 * photo source only — there is no in-app drawing step, and no `'choose'`
 * step to introduce one.
 *
 * Two entry paths, distinguished by whether a Property already exists rather
 * than by a route param, since the account has at most one (MVP):
 * - **none yet** — the gardener is creating a Property from a photo, with no
 *   address and no geocoding at all (CONTEXT.md's Property entry: choosing
 *   photo/drawn is partly a privacy choice, so nothing is ever sent to a
 *   geocoder). Asks for a name first, since there's no address to identify it.
 * - **one already** — an aerial Property whose address turned out to have no
 *   imagery coverage. This completes that original setup, so no name is asked
 *   for and the existing row is updated.
 *
 * Everything stays in local state until "Save Scale Reference" writes it in
 * one call. That isn't only so a Property never sits half-configured: the
 * `properties_base_map_source_consistent` check constraint (migration 0017)
 * *rejects* a `'photo'` row whose `scale_reference` is still null, so a
 * two-step save would fail outright.
 */
export function BaseMapSetupScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const repository = usePropertiesRepository()
  const { width } = useWindowDimensions()

  const displayScale = mapDisplayScale(width - SCREEN_PADDING * 2)
  const surfaceSize = STAGE_SIZE_PX * displayScale

  const [existing, setExisting] = useState<Property | null | undefined>(undefined)
  const [step, setStep] = useState<Step>('photo')

  // Chosen up front so an uploaded photo's storage path is filed under the
  // same id the Property row is later inserted with — see
  // `createWithBaseMap`. Unused when completing an existing Property.
  const [pendingId] = useState(() => Crypto.randomUUID())

  const [name, setName] = useState('')
  const [photo, setPhoto] = useState<PickedPhoto | null>(null)
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [points, setPoints] = useState<ScalePoint[]>([])
  const [mode, setMode] = useState<ScaleReferenceMode>('known-measurement')
  const [distanceFeet, setDistanceFeet] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    repository
      .get()
      .then((property) => {
        if (cancelled) return
        setExisting(property)
        setStep(property === null ? 'name' : 'photo')
      })
      .catch(() => {
        if (cancelled) return
        // Deliberately not falling through to the create flow: an account
        // that already has a Property would then be offered a second one and
        // hit the one-per-account unique index at the very end, after the
        // gardener had photographed and calibrated a plan for nothing.
        setLoadFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [repository])

  const propertyId = existing?.id ?? pendingId

  /**
   * Saving here rewrites all four base-map columns as one set, so running it
   * against a Property whose base map is already a photo or a drawn plan
   * would discard that plan. Only an `'aerial'` Property is ever completed
   * this way — CONTEXT.md's Property entry allows exactly that one exception
   * to "the choice is made once, at creation", because an address with no
   * imagery coverage leaves the original setup genuinely unfinished.
   *
   * The check constraint in migration 0017 already makes an uncalibrated
   * photo/drawn Property impossible, so this is a guard against a future
   * schema or routing change rather than a state reachable today.
   */
  const canCompleteExisting = !existing || existing.baseMapSource === 'aerial'

  async function handlePickPhoto(source: PhotoSource) {
    setError(null)
    let picked: PickedPhoto | null
    try {
      picked = await pickPhoto(source)
    } catch (err) {
      // A denied permission is the expected case here — `pickPhoto` throws a
      // message already written for the gardener.
      setError(err instanceof Error ? err.message : 'Could not open your photos.')
      return
    }
    if (!picked) return

    setBusy(true)
    try {
      // Uploaded now rather than at save time so a permission or storage
      // failure surfaces while the gardener is still on the photo step and can
      // simply pick another, rather than after they've done the calibration.
      const path = await repository.uploadBaseMapPhoto(propertyId, picked)
      setPhoto(picked)
      setPhotoPath(path)
    } catch {
      setError('Could not upload this photo. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  /** A third tap starts a fresh pair, so a misplaced point is corrected by tapping again rather than by a separate Clear control. Matches web's `handleCanvasClick`. */
  function handleSurfacePress(locationX: number, locationY: number) {
    const point = tappedStagePoint(locationX, locationY, displayScale)
    setPoints((prev) => (prev.length >= 2 ? [point] : [...prev, point]))
  }

  async function handleSave() {
    if (points.length < 2) {
      setError('Tap two points on the base map to calibrate its scale.')
      return
    }
    // Unreachable at runtime — the calibrate step is only entered once the
    // upload has returned a path — but it is what narrows `photoPath` to a
    // string for the two calls below.
    if (!photoPath) {
      setError('Add a photo of your plot plan first.')
      return
    }

    const scaleReference = {
      pointA: points[0],
      pointB: points[1],
      realDistanceFeet: Number(distanceFeet),
      mode,
    }
    const validation = validateScaleReferenceInput(scaleReference)
    if (!validation.ok) {
      setError(Object.values(validation.errors)[0] ?? 'Could not save this Scale Reference.')
      return
    }

    setError(null)
    setSaving(true)
    try {
      if (existing) {
        await repository.updateBaseMap(existing.id, {
          baseMapSource: 'photo',
          baseMapPhotoPath: photoPath,
          baseMapDrawing: null,
          scaleReference,
        })
      } else {
        await repository.createWithBaseMap({
          id: pendingId,
          name: name.trim(),
          baseMapSource: 'photo',
          baseMapPhotoPath: photoPath,
          scaleReference,
        })
      }
      // The Map screen reloads its Property on focus, so going back is all
      // that's needed to show the newly calibrated map.
      navigation.goBack()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this base map.')
    } finally {
      setSaving(false)
    }
  }

  function renderBody() {
    if (existing && !canCompleteExisting) {
      return (
        <Text>
          This Property already has a {existing.baseMapSource === 'photo' ? 'photographed' : 'drawn'}{' '}
          base map. Changing it means recreating the Property, which is done on the desktop app.
        </Text>
      )
    }

    if (loadFailed) {
      return (
        <Text style={styles.error}>
          Could not check whether you already have a Property. Go back and try again.
        </Text>
      )
    }

    if (existing === undefined) {
      return <Text>Loading…</Text>
    }

    if (step === 'name') {
      return (
        <>
          <Text style={styles.title}>Name your map</Text>
          <Text>
            A photographed plot plan needs no address — nothing about where you live is sent
            anywhere. Give it a name so you can recognise it.
          </Text>
          <TextInput
            accessibilityLabel="Name your map"
            style={styles.input}
            value={name}
            onChangeText={setName}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            accessibilityRole="button"
            disabled={!name.trim()}
            style={[styles.button, !name.trim() && styles.buttonDisabled]}
            onPress={() => setStep('photo')}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </Pressable>
        </>
      )
    }

    if (step === 'photo') {
      return (
        <>
          <Text style={styles.title}>Photograph your plot plan</Text>
          <Text>
            A survey, plot plan or sketch — anything showing your property's structure. You'll set
            its scale next.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            style={styles.button}
            onPress={() => void handlePickPhoto('camera')}
          >
            <Text style={styles.buttonText}>{photo ? 'Take another photo' : 'Take a photo'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            style={styles.buttonSecondary}
            onPress={() => void handlePickPhoto('library')}
          >
            <Text>{photo ? 'Choose a different photo' : 'Choose from library'}</Text>
          </Pressable>
          {busy && <Text>Uploading…</Text>}
          {error && <Text style={styles.error}>{error}</Text>}

          {/* Shown before moving on, as web does: a plot plan photographed at
              arm's length is easily blurry or cropped short, and the two
              points are about to be tapped against it. Picking again simply
              replaces it. */}
          {photo && !busy && (
            <>
              <Text style={styles.label}>Is the whole plan readable?</Text>
              <Image
                source={{ uri: photo.uri }}
                accessibilityLabel="Photographed plot plan or survey"
                resizeMode="contain"
                style={{ width: surfaceSize, height: surfaceSize }}
              />
              <Pressable
                accessibilityRole="button"
                style={styles.button}
                onPress={() => setStep('calibrate')}
              >
                <Text style={styles.buttonText}>Continue to Scale Reference</Text>
              </Pressable>
            </>
          )}
        </>
      )
    }

    return (
      <>
        <Text style={styles.title}>Scale Reference</Text>
        <Text>
          Tap two points on your plan, then enter the real-world distance between them.
        </Text>
        <Text>
          Pick points as far apart as the plan allows — a longer reference makes the scale far less
          sensitive to a slightly-off tap or measurement.
        </Text>

        <View style={{ width: surfaceSize, height: surfaceSize }}>
          {photo && (
            <Image
              source={{ uri: photo.uri }}
              accessibilityLabel="Photographed plot plan or survey"
              resizeMode="contain"
              style={StyleSheet.absoluteFill}
            />
          )}
          <Svg
            testID="scale-reference-overlay"
            width={surfaceSize}
            height={surfaceSize}
            viewBox={`0 0 ${STAGE_SIZE_PX} ${STAGE_SIZE_PX}`}
            style={StyleSheet.absoluteFill}
          >
            {/* The tap target is an SVG shape rather than a `Pressable`
                wrapper so it sits in the same responder tree as the markers
                drawn over it — the same drawn-small/tapped-large arrangement
                the Map screen's Pins use. `locationX`/`locationY` arrive in
                the view's own pixels, which is what `tappedStagePoint`
                converts back through the display scale. */}
            <Rect
              x={0}
              y={0}
              width={STAGE_SIZE_PX}
              height={STAGE_SIZE_PX}
              // A shape only takes touches where it has a fill, so this needs
              // a real colour at zero opacity rather than `none` — the same
              // arrangement the Map screen's Pin hit-circles use. Which
              // colour is arbitrary; it is never drawn.
              fill={POINT_FILL}
              fillOpacity={0}
              accessibilityLabel="Plot plan — tap to place a Scale Reference point"
              testID="scale-reference-surface"
              onPress={(event) =>
                handleSurfacePress(event.nativeEvent.locationX, event.nativeEvent.locationY)
              }
            />
            {points.length === 2 && (
              <Line
                x1={points[0].x}
                y1={points[0].y}
                x2={points[1].x}
                y2={points[1].y}
                stroke={POINT_FILL}
                strokeWidth={1.5 / displayScale}
                strokeDasharray={`${4 / displayScale} ${3 / displayScale}`}
                pointerEvents="none"
              />
            )}
            {points.map((point, index) => (
              <Circle
                key={index}
                cx={point.x}
                cy={point.y}
                r={POINT_RADIUS_PX / displayScale}
                fill={POINT_FILL}
                stroke="#fff"
                strokeWidth={1.5 / displayScale}
                pointerEvents="none"
              />
            ))}
          </Svg>
        </View>

        <Text style={styles.label}>How do you know this distance?</Text>
        <View style={styles.modeRow}>
          {MODES.map((option) => (
            <Pressable
              key={option.mode}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === option.mode }}
              style={[
                styles.buttonSecondary,
                styles.modeButton,
                mode === option.mode && styles.buttonActive,
              ]}
              onPress={() => setMode(option.mode)}
            >
              <Text style={mode === option.mode && styles.buttonActiveText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>{MODES.find((option) => option.mode === mode)?.hint}</Text>

        <Text style={styles.label}>Real-world distance (feet)</Text>
        <TextInput
          accessibilityLabel="Real-world distance (feet)"
          style={styles.input}
          // Not `number-pad`, unlike every other numeric field in this app:
          // those are whole counts (a quantity, a year, a month), whereas a
          // tape-measured run is routinely 42.5 ft, and web's own field is
          // `step="any"`. `number-pad` has no decimal key on iOS, so it would
          // silently make the phone's calibration coarser than the desktop's.
          keyboardType="decimal-pad"
          value={distanceFeet}
          onChangeText={setDistanceFeet}
        />

        {/* Deliberately just above Save, not at the top of the scroll view:
            #18's device QA found a failed Save gave no visible feedback when
            its message was scrolled out of sight, and web still has the same
            bug open as #32. */}
        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          accessibilityRole="button"
          disabled={saving}
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={() => void handleSave()}
        >
          <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save Scale Reference'}</Text>
        </Pressable>
      </>
    )
  }

  return (
    <SafeAreaView style={styles.filler} edges={['top', 'left', 'right']}>
      <KeyboardAwareScrollView contentContainerStyle={styles.container}>
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>

        {renderBody()}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  )
}

const POINT_FILL = '#e63946'

/** Both Scale Reference modes (CONTEXT.md) produce identical data — two points plus a distance — so this only drives which prompt is shown. */
const MODES: { mode: ScaleReferenceMode; label: string; hint: string }[] = [
  {
    mode: 'known-measurement',
    label: 'Known measurement',
    hint: 'A distance already stated on the plan, or a property dimension you know.',
  },
  {
    mode: 'measured-object',
    label: 'Measured object',
    hint: 'A fence or wall run you tape-measured yourself — something fixed and permanent.',
  },
]

const styles = StyleSheet.create({
  filler: {
    flex: 1,
  },
  container: {
    padding: SCREEN_PADDING,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  label: {
    fontWeight: '600',
  },
  hint: {
    color: '#555',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 12,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    flex: 1,
  },
  button: {
    backgroundColor: '#2e7d32',
    borderRadius: 4,
    padding: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: '#2e7d32',
    borderRadius: 4,
    padding: 12,
    alignItems: 'center',
  },
  buttonActive: {
    backgroundColor: '#2e7d32',
  },
  buttonActiveText: {
    color: '#fff',
    fontWeight: '600',
  },
  error: {
    color: '#b00020',
  },
  cancelText: {
    color: '#2e7d32',
  },
})
