import type { Bed, BedPoint, Plant, Planting, PlantingInput, Property } from '@plant-app/domain'
import {
  STAGE_SIZE_PX,
  feetToPixels,
  pixelsPerFootForProperty,
  plantLabel,
  renderedBedOutlines,
  resolvePinDrop,
  svgPointsAttribute,
  validatePlantingInput,
} from '@plant-app/domain'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, G, Line, Polygon } from 'react-native-svg'
import { KeyboardAwareScrollView } from '../components/KeyboardAwareScrollView'
import type { MainStackParamList } from '../navigation/types'
import { usePlantsRepository } from '../plants/PlantsRepositoryContext'
import { usePlantingsRepository } from '../plantings/PlantingsRepositoryContext'
import { useBedsRepository } from './BedsRepositoryContext'
import { NativeBaseMap } from './NativeBaseMap'
import { draggedStagePoint, indicesWithinTapRange, mapDisplayScale } from './mapSurface'
import { usePropertiesRepository } from './PropertiesRepositoryContext'

const SCREEN_PADDING = 24

const BED_STROKE = '#52b788'
const BED_FILL = 'rgba(82,183,136,0.12)'
const PIN_FILL = '#2d6a4f'
const NEW_PIN_FILL = '#e63946'

/** On-screen sizes in device pixels, divided back out of the display scale wherever they're drawn inside the map's own (shrunk) coordinate space — a Pin has to stay thumb-sized however small the map is drawn, unlike the map's contents, which scale with it. */
const BED_STROKE_WIDTH_PX = 1.5
const PIN_RADIUS_PX = 9
const NEW_PIN_RADIUS_PX = 11
/** Roughly a fingertip: the invisible circle that actually catches a tap, larger than the dot it's drawn as. */
const PIN_TAP_RADIUS_PX = 18
/**
 * The same courtesy for the marker being dragged, and then some — grabbing it
 * is the whole interaction, and a finger covers it completely while dragging.
 * Deliberately well past the 44pt HIG minimum a *tap* target needs: #14's
 * device QA found that a near-miss doesn't merely fail to grab the marker, it
 * lands on the map underneath and scrolls the page instead, which is a far
 * worse outcome than a missed tap. Widening the grab is what makes that rare.
 */
const NEW_PIN_TAP_RADIUS_PX = 32
/**
 * How far the drag crosshair's arms reach past the marker, in device pixels.
 * Deliberately longer than a fingertip is wide: the crosshair exists precisely
 * because a finger hides the dot it's dragging (#14's device QA), so its whole
 * value is in the part still visible around the outside of the fingertip.
 */
const CROSSHAIR_REACH_PX = 46
/** Wide enough to enclose a whole cluster — Pins only cluster within two tap radii of each other — plus the dots themselves. */
const CLUSTER_RING_RADIUS_PX = 28
/** How far the chooser sheet travels on its way in. Short and fixed rather than measured: it only has to read as "rising from below", and pairing it with a fade means a sheet taller than this still never appears mid-air. */
const SHEET_RISE_PX = 240

/**
 * When a Planting was added, in local time and to the minute.
 *
 * To the *minute*, not the day: a gardener planting a group adds them in one
 * sitting, so the date alone left three rows still reading identically (#14's
 * device QA). Two Plantings can't realistically be created within the same
 * minute through the UI, so this is what finally separates them.
 *
 * Formatted by hand rather than through `toLocaleString`, so the output
 * doesn't shift with the device's locale — this is an identifier to tell rows
 * apart, and it wants to look the same everywhere.
 */
function formatAddedAt(iso: string): string {
  const at = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  const date = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
  return `${date} ${pad(at.getHours())}:${pad(at.getMinutes())}`
}

/**
 * What tells two Plantings of the same Plant apart in the chooser.
 *
 * Three rows all reading "Rose campion ×1" are no better than guessing, and
 * the Plant's name is by definition the part they share. Year and nursery are
 * the differences a gardener actually thinks in, but both are optional and
 * both can legitimately be identical, so the added time always comes last and
 * is never omitted — it's the only field guaranteed to differ between two
 * rows. Note that position can't help here at all: these Pins are in the
 * chooser precisely because they overlap.
 */
function plantingDistinguishers(planting: Planting): string {
  const parts: string[] = []
  if (planting.yearAcquired) parts.push(`acquired ${planting.yearAcquired}`)
  if (planting.sourceNursery) parts.push(planting.sourceNursery)
  parts.push(`added ${formatAddedAt(planting.createdAt)}`)
  return parts.join(' · ')
}

const EMPTY_FORM = {
  plantId: '',
  quantity: '1',
  yearAcquired: '',
  sourceNursery: '',
}

const CENTER_OF_SURFACE: BedPoint = { x: STAGE_SIZE_PX / 2, y: STAGE_SIZE_PX / 2 }

/**
 * The phone's Map (ticket #14): a Property's base map with its Beds drawn on
 * it, every Planting's Pin tappable, and a new Pin placed by dragging —
 * the same interaction as web's `PlantingMap`, which is the point (CONTEXT.md's
 * Pin entry: "Works identically on desktop and phone").
 *
 * Deliberately *not* here: any way to draw a Bed, or to draw a base plan in
 * the app. Freehand/shape drawing is desktop-only by design (ADR-0001,
 * reaffirmed by ADR-0003's parity exception), so this screen only ever reads
 * Beds.
 *
 * Base-map photo upload and Scale Reference calibration are a different
 * matter — ADR-0003 puts both at *full* phone parity, they're just not built
 * natively yet (#15). So the empty states below say they aren't in the phone
 * app yet and point at the desktop app for now, rather than claiming a
 * design boundary that doesn't exist.
 *
 * The map is the same fixed `STAGE_SIZE_PX` square web draws, scaled down to
 * the phone's width — see `mapSurface`, which owns that conversion so a
 * finger's drag lands where the gardener put it.
 */
export function MapScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const propertiesRepository = usePropertiesRepository()
  const bedsRepository = useBedsRepository()
  const plantsRepository = usePlantsRepository()
  const plantingsRepository = usePlantingsRepository()

  const [property, setProperty] = useState<Property | null | undefined>(undefined)
  const [beds, setBeds] = useState<Bed[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [plantings, setPlantings] = useState<Planting[]>([])
  // Kept apart from `loadError`: failing to load the Property means there's
  // no map to draw at all, while everything else that can fail (Beds,
  // Plants, Plantings) still leaves a usable map behind it.
  const [propertyError, setPropertyError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // The Plantings a single tap couldn't choose between, once it landed on more
  // than one Pin. Null whenever the tap was unambiguous — which is the normal
  // case, and still navigates straight through.
  const [cluster, setCluster] = useState<Planting[] | null>(null)

  // Driven by hand rather than by Modal's own `animationType="slide"`, which
  // slides the *whole* modal — backdrop included — so the dimming shade flew
  // up from the bottom as a hard-edged box (#14's device QA). A backdrop has
  // to fade; only the sheet should travel.
  const appear = useRef(new Animated.Value(0)).current
  const sheetRise = useRef(new Animated.Value(SHEET_RISE_PX)).current

  useEffect(() => {
    if (!cluster) return
    appear.setValue(0)
    sheetRise.setValue(SHEET_RISE_PX)
    Animated.parallel([
      Animated.timing(appear, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(sheetRise, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start()
  }, [cluster, appear, sheetRise])

  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [pinStage, setPinStage] = useState<BedPoint>(CENTER_OF_SURFACE)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const { width } = useWindowDimensions()
  const displayScale = mapDisplayScale(width - SCREEN_PADDING * 2)
  const surfaceSize = STAGE_SIZE_PX * displayScale
  // Divided back out of the display scale like every other on-screen size
  // here, so the arms reach the same distance past a fingertip whatever the
  // map has been shrunk to.
  const crosshairReach = CROSSHAIR_REACH_PX / displayScale

  // useFocusEffect, not a plain mount effect: the native stack keeps this
  // screen mounted underneath PlantingDetail, so a Planting removed there
  // would otherwise leave its Pin on this map until the app remounted the
  // screen from scratch. Same reasoning as RegistryScreen's fetches.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      setPropertyError(null)
      propertiesRepository
        .get()
        .then((result) => {
          if (cancelled) return
          setProperty(result)
          if (!result) return
          // Its own success and its own failure: the base map and its scale
          // have already loaded by this point, so a Beds failure costs the
          // outlines, not the map. Chaining it into the Property's `.catch`
          // below would report it as "you have no Property".
          bedsRepository
            .list(result.id)
            .then((bedList) => {
              if (!cancelled) setBeds(bedList)
            })
            .catch(() => {
              if (!cancelled) setLoadError('Could not load this Property’s Beds.')
            })
        })
        .catch(() => {
          if (!cancelled) setPropertyError('Could not load your Property. Please try again.')
        })
      return () => {
        cancelled = true
      }
    }, [propertiesRepository, bedsRepository]),
  )

  useFocusEffect(
    useCallback(() => {
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
    }, [plantsRepository]),
  )

  // Keyed off `beds` rather than focus: the Beds fetch above already re-runs
  // on every focus, and its fresh array is what this depends on.
  const bedIds = useMemo(() => beds.map((bed) => bed.id), [beds])
  useFocusEffect(
    useCallback(() => {
      if (bedIds.length === 0) {
        setPlantings([])
        return
      }
      let cancelled = false
      plantingsRepository
        .listByBeds(bedIds)
        .then((result) => {
          if (!cancelled) setPlantings(result)
        })
        .catch(() => {
          if (!cancelled) setLoadError('Could not load this Property’s Plantings.')
        })
      return () => {
        cancelled = true
      }
    }, [bedIds, plantingsRepository]),
  )

  const pixelsPerFootValue = property ? pixelsPerFootForProperty(property) : null

  // The shapes the Beds are actually drawn as — one source of truth for both
  // what's rendered and what a dropped Pin is tested against, so a Pin can
  // never resolve into a Bed it visibly isn't in.
  const outlines = useMemo(() => renderedBedOutlines(beds), [beds])

  // Where on the map the sheet below is talking about. The sheet slides up
  // over the bottom of the screen, so without something drawn up here the
  // gardener is told "2 Plantings here" with no way to see where "here" is.
  const clusterCentre = useMemo(() => {
    if (!cluster || pixelsPerFootValue === null) return null
    const points = cluster.map((planting) => feetToPixels([planting.pin], pixelsPerFootValue)[0])
    return {
      x: points.reduce((total, point) => total + point.x, 0) / points.length,
      y: points.reduce((total, point) => total + point.y, 0) / points.length,
    }
  }, [cluster, pixelsPerFootValue])
  const drop = useMemo(
    () =>
      pixelsPerFootValue === null ? null : resolvePinDrop(pinStage, pixelsPerFootValue, outlines),
    [pinStage, pixelsPerFootValue, outlines],
  )

  // Suspends the ScrollView for the duration of a drag — see the PanResponder
  // below for why nothing in the responder config can do that on iOS.
  const [dragging, setDragging] = useState(false)

  // The drag reads these through refs because `PanResponder` is built once
  // and would otherwise capture the first render's values forever.
  const pinStageRef = useRef(pinStage)
  const displayScaleRef = useRef(displayScale)
  const dragStartRef = useRef(pinStage)
  useEffect(() => {
    pinStageRef.current = pinStage
    displayScaleRef.current = displayScale
  }, [pinStage, displayScale])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStartRef.current = pinStageRef.current
          setDragging(true)
        },
        onPanResponderMove: (_event, gesture) => {
          setPinStage(draggedStagePoint(dragStartRef.current, gesture.dx, gesture.dy, displayScaleRef.current))
        },
        // Release and terminate exist only to hand scrolling back. They
        // deliberately don't settle the drop: web's Konva marker resolves it
        // imperatively on `dragend`, but here the resolved Bed is derived from
        // `pinStage` (see `drop` above), so the last move frame has already
        // settled it — an OS-terminated gesture still leaves the Pin correctly
        // resolved where it stopped.
        onPanResponderRelease: () => setDragging(false),
        onPanResponderTerminate: () => setDragging(false),
        // Neither of these keeps the map from scrolling under the drag. Both
        // concern the *JS* responder, while the ScrollView scrolls via iOS's
        // own UIScrollView pan recogniser running in parallel — and
        // `onShouldBlockNativeResponder` is Android-only (RN's own docs say
        // so). Suspending the ScrollView through `scrollEnabled` is what
        // actually keeps a downward drag of the Pin a drag of the Pin; these
        // two are kept for Android and for JS-side responder competition.
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }),
    [],
  )

  /**
   * Which Planting a tap on a Pin meant.
   *
   * Pins are drawn in list order, so overlapping ones used to be decided by
   * whichever happened to come last in the array — arbitrary, and invisible to
   * the gardener (#14's device QA). Now a tap gathers every Pin close enough to
   * be under the same fingertip: one match opens straight through as before,
   * several offer the choice rather than guessing.
   */
  function handlePinPress(planting: Planting) {
    if (pixelsPerFootValue === null) return
    const [target] = feetToPixels([planting.pin], pixelsPerFootValue)
    const points = plantings.map((p) => feetToPixels([p.pin], pixelsPerFootValue)[0])
    const matches = indicesWithinTapRange(points, target, PIN_TAP_RADIUS_PX, displayScale).map(
      (index) => plantings[index],
    )
    if (matches.length <= 1) {
      navigation.navigate('PlantingDetail', { plantingId: planting.id })
      return
    }
    setCluster(matches)
  }

  function handleOpenPlanting(plantingId: string) {
    setCluster(null)
    navigation.navigate('PlantingDetail', { plantingId })
  }

  function handleStartAdding() {
    setCluster(null)
    setAdding(true)
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setFormError(null)
    setPinStage(CENTER_OF_SURFACE)
  }

  function updateField<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSave() {
    if (!drop?.bed) {
      setFormError('Drag the pin onto a Bed before saving.')
      return
    }
    const input: PlantingInput = {
      plantId: form.plantId,
      bedId: drop.bed.id,
      quantity: Number(form.quantity),
      pin: drop.feet,
      ...(form.yearAcquired && { yearAcquired: Number(form.yearAcquired) }),
      ...(form.sourceNursery.trim() && { sourceNursery: form.sourceNursery.trim() }),
    }
    const validation = validatePlantingInput(input)
    if (!validation.ok) {
      setFieldErrors(validation.errors)
      // A summary rather than the field's own message repeated: the offending
      // field may well be scrolled off screen next to the Save button (#18's
      // QA turned up exactly that), but echoing its sentence verbatim a few
      // lines below itself just reads as the app saying the same thing twice.
      setFormError('Check the highlighted fields above.')
      return
    }
    setFieldErrors({})
    setFormError(null)
    setSaving(true)
    try {
      const created = await plantingsRepository.create(input)
      setPlantings((current) => [...current, created])
      setAdding(false)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save this Planting.')
    } finally {
      setSaving(false)
    }
  }

  function renderBody() {
    if (propertyError) {
      return <Text style={styles.error}>{propertyError}</Text>
    }
    if (property === undefined) {
      return <Text>Loading…</Text>
    }
    if (property === null) {
      return (
        <Text>
          You don’t have a Property yet. Creating one isn’t in the phone app yet — set it up on the
          desktop app.
        </Text>
      )
    }
    if (pixelsPerFootValue === null) {
      return (
        <Text>
          This Property has no map scale yet. Calibrating one isn’t in the phone app yet — finish its
          base map and Scale Reference on the desktop app, and its Beds and Pins will show here.
        </Text>
      )
    }

    return (
      <>
        <View style={[styles.surface, { width: surfaceSize, height: surfaceSize }]}>
          <NativeBaseMap property={property} size={surfaceSize} />
          <Svg
            width={surfaceSize}
            height={surfaceSize}
            viewBox={`0 0 ${STAGE_SIZE_PX} ${STAGE_SIZE_PX}`}
            style={styles.overlay}
            testID="map-overlay"
          >
            {outlines.map((bed) => (
              <Polygon
                key={bed.id}
                testID={`bed-outline-${bed.id}`}
                points={svgPointsAttribute(feetToPixels(bed.points, pixelsPerFootValue))}
                fill={BED_FILL}
                stroke={BED_STROKE}
                strokeWidth={BED_STROKE_WIDTH_PX / displayScale}
              />
            ))}
            {plantings.map((planting) => {
              const [pin] = feetToPixels([planting.pin], pixelsPerFootValue)
              const label = plantLabel(plants.find((p) => p.id === planting.plantId))
              return (
                // Drawn small, tapped large: the visible dot keeps the map
                // readable where Pins sit close together, while a wider
                // transparent circle behind it catches a fingertip. Both come
                // off the same `pin`, so the two can't drift apart.
                <Fragment key={planting.id}>
                  <Circle
                    cx={pin.x}
                    cy={pin.y}
                    r={PIN_TAP_RADIUS_PX / displayScale}
                    fill={PIN_FILL}
                    fillOpacity={0}
                    // No `accessibilityRole` — SVG shapes don't take one, so a
                    // screen reader gets these Plantings from the list below
                    // rather than from the map itself.
                    accessibilityLabel={`View ${label}`}
                    testID={`map-pin-${planting.id}`}
                    onPress={() => handlePinPress(planting)}
                  />
                  <Circle
                    cx={pin.x}
                    cy={pin.y}
                    r={PIN_RADIUS_PX / displayScale}
                    fill={PIN_FILL}
                    stroke="white"
                    strokeWidth={1.5 / displayScale}
                    // Purely decorative: the transparent circle underneath is
                    // what takes the tap, so this never swallows one.
                    pointerEvents="none"
                  />
                </Fragment>
              )
            })}

            {clusterCentre && (
              // White under green, the same trick the crosshair uses: a lone
              // ring is unreadable over aerial imagery, and this one has to be
              // findable at a glance while a sheet covers the lower screen.
              <G testID="cluster-highlight">
                <Circle
                  cx={clusterCentre.x}
                  cy={clusterCentre.y}
                  r={CLUSTER_RING_RADIUS_PX / displayScale}
                  fill="none"
                  stroke="white"
                  strokeOpacity={0.9}
                  strokeWidth={4 / displayScale}
                />
                <Circle
                  cx={clusterCentre.x}
                  cy={clusterCentre.y}
                  r={CLUSTER_RING_RADIUS_PX / displayScale}
                  fill="none"
                  stroke={PIN_FILL}
                  strokeWidth={2 / displayScale}
                />
              </G>
            )}

            {adding && dragging && (
              <G testID="pin-crosshair">
                {(
                  [
                    ['h', pinStage.x - crosshairReach, pinStage.y, pinStage.x + crosshairReach, pinStage.y],
                    ['v', pinStage.x, pinStage.y - crosshairReach, pinStage.x, pinStage.y + crosshairReach],
                  ] as const
                ).map(([axis, x1, y1, x2, y2]) => (
                  // Drawn twice, a white arm under a red one: a lone red
                  // hairline vanishes against aerial imagery, and this exists
                  // to stay readable exactly where a fingertip has hidden the
                  // marker it belongs to.
                  <Fragment key={axis}>
                    <Line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="white"
                      strokeOpacity={0.9}
                      strokeWidth={3 / displayScale}
                    />
                    <Line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={NEW_PIN_FILL}
                      strokeWidth={1 / displayScale}
                    />
                  </Fragment>
                ))}
              </G>
            )}
          </Svg>

          {adding && (
            <View
              {...panResponder.panHandlers}
              // Labelled but given no role: dragging is the only way to move
              // it, which a screen reader can't drive — the same gap web's
              // Konva marker has. The label at least says what the thing is.
              accessibilityLabel="New Planting pin — drag onto a Bed"
              testID="new-pin"
              style={[
                styles.newPinTarget,
                {
                  left: pinStage.x * displayScale - NEW_PIN_TAP_RADIUS_PX,
                  top: pinStage.y * displayScale - NEW_PIN_TAP_RADIUS_PX,
                  width: NEW_PIN_TAP_RADIUS_PX * 2,
                  height: NEW_PIN_TAP_RADIUS_PX * 2,
                },
              ]}
            >
              <View style={styles.newPinDot} />
            </View>
          )}
        </View>

        {beds.length === 0 && <Text>No Beds drawn yet — Beds are drawn on the desktop app.</Text>}

        {beds.length > 0 &&
          (adding ? renderAddForm() : (
            <Pressable
              accessibilityRole="button"
              style={[styles.button, plants.length === 0 && styles.buttonDisabled]}
              disabled={plants.length === 0}
              onPress={handleStartAdding}
            >
              <Text style={styles.buttonText}>Add Planting</Text>
            </Pressable>
          ))}

        {beds.length > 0 && plants.length === 0 && (
          <Text>Add a Plant to the Registry before creating a Planting.</Text>
        )}

        {renderPlantingList()}
      </>
    )
  }

  function renderAddForm() {
    return (
      <View accessibilityLabel="Add Planting" style={styles.section}>
        <Text style={styles.sectionTitle}>Add Planting</Text>
        {/* Save is disabled on exactly two conditions — no Bed under the pin,
            and no Plant chosen — and nothing on screen named the second one
            (#14's device QA). A placed pin with no Plant chosen left an
            encouraging "Pin is in X." above a dead grey button. */}
        <Text>
          {drop?.bed
            ? `Pin is in ${drop.bed.name}.`
            : 'Drag the pin onto a Bed to place this Planting.'}
          {!form.plantId && ' Choose a Plant to save.'}
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Plant *</Text>
          {plants.map((plant) => {
            const selected = form.plantId === plant.id
            return (
              <Pressable
                key={plant.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => updateField('plantId', plant.id)}
              >
                <Text style={selected ? styles.optionTextSelected : undefined}>
                  {plantLabel(plant)}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Quantity *</Text>
          <TextInput
            accessibilityLabel="Quantity"
            style={styles.input}
            keyboardType="number-pad"
            value={form.quantity}
            onChangeText={(value) => updateField('quantity', value)}
          />
          {fieldErrors.quantity && <Text style={styles.error}>{fieldErrors.quantity}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Year acquired</Text>
          <TextInput
            accessibilityLabel="Year acquired"
            style={styles.input}
            keyboardType="number-pad"
            maxLength={4}
            value={form.yearAcquired}
            onChangeText={(value) => updateField('yearAcquired', value)}
          />
          {fieldErrors.yearAcquired && <Text style={styles.error}>{fieldErrors.yearAcquired}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Source / nursery</Text>
          <TextInput
            accessibilityLabel="Source / nursery"
            style={styles.input}
            value={form.sourceNursery}
            onChangeText={(value) => updateField('sourceNursery', value)}
          />
        </View>

        {formError && <Text style={styles.error}>{formError}</Text>}

        <View style={styles.formActions}>
          <Pressable
            accessibilityRole="button"
            style={[
              styles.button,
              styles.formActionButton,
              (saving || !form.plantId || !drop?.bed) && styles.buttonDisabled,
            ]}
            disabled={saving || !form.plantId || !drop?.bed}
            onPress={handleSave}
          >
            <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save Planting'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={[styles.buttonSecondary, styles.formActionButton]}
            disabled={saving}
            onPress={() => {
              setAdding(false)
              setFormError(null)
            }}
          >
            <Text>Cancel</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  /** The same Pins as a plain list — a tap target a Pin-sized dot can't reliably offer, and the only way to reach a Planting with a screen reader. */
  function renderPlantingList() {
    if (plantings.length === 0) return null
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Plantings</Text>
        {plantings.map((planting) => {
          const label = plantLabel(plants.find((p) => p.id === planting.plantId))
          const bed = beds.find((b) => b.id === planting.bedId)
          return (
            <Pressable
              key={planting.id}
              accessibilityRole="button"
              style={styles.listRow}
              onPress={() => navigation.navigate('PlantingDetail', { plantingId: planting.id })}
            >
              <Text>
                {label} ×{planting.quantity}
                {bed && ` in ${bed.name}`}
              </Text>
            </Pressable>
          )
        })}
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.container}
        // Suspended for the duration of a Pin drag — nothing in the
        // PanResponder config can stop iOS's own scroll recogniser.
        scrollEnabled={!dragging}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Map</Text>
          <Pressable accessibilityRole="button" onPress={() => navigation.goBack()}>
            <Text style={styles.backLink}>Back to Dashboard</Text>
          </Pressable>
        </View>
        {loadError && <Text style={styles.error}>{loadError}</Text>}
        {renderBody()}
      </KeyboardAwareScrollView>

      {/* A sheet rather than a section further down the page: the whole
          interaction happens on the map, and #14's device QA found a chooser
          rendered below it simply wasn't noticed — right content, outside
          where the gardener was looking. This comes up over the map instead,
          with `clusterHighlight` ringing the Pins it means. */}
      {cluster && (
        <Modal visible transparent animationType="none" onRequestClose={() => setCluster(null)}>
          <Animated.View style={[styles.sheetBackdrop, { opacity: appear }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              style={styles.sheetBackdropTouch}
              onPress={() => setCluster(null)}
            />
          </Animated.View>
          <Animated.View
            accessibilityViewIsModal
            accessibilityLabel="Choose a Planting"
            style={[styles.sheet, { opacity: appear, transform: [{ translateY: sheetRise }] }]}
          >
            <Text style={styles.sectionTitle}>{cluster.length} Plantings here</Text>
            <Text>These Pins are too close together to tell apart by tapping.</Text>
            {cluster.map((planting) => (
              <Pressable
                key={planting.id}
                accessibilityRole="button"
                style={styles.option}
                testID={`cluster-choice-${planting.id}`}
                onPress={() => handleOpenPlanting(planting.id)}
              >
                <Text>
                  {plantLabel(plants.find((p) => p.id === planting.plantId))} ×{planting.quantity}
                </Text>
                <Text style={styles.optionDetail}>{plantingDistinguishers(planting)}</Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              style={styles.buttonSecondary}
              onPress={() => setCluster(null)}
            >
              <Text>Cancel</Text>
            </Pressable>
          </Animated.View>
        </Modal>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: SCREEN_PADDING,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  surface: {
    position: 'relative',
    backgroundColor: '#f2f2f2',
  },
  overlay: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  // Transparent and fingertip-sized — what the drag actually grabs.
  newPinTarget: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Drawn small and centred inside it, so the map stays readable.
  newPinDot: {
    width: NEW_PIN_RADIUS_PX * 2,
    height: NEW_PIN_RADIUS_PX * 2,
    borderRadius: NEW_PIN_RADIUS_PX,
    backgroundColor: NEW_PIN_FILL,
    borderWidth: 2,
    borderColor: 'white',
  },
  section: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
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
  option: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 12,
  },
  optionSelected: {
    borderColor: '#2e7d32',
    backgroundColor: '#e8f5e9',
  },
  optionTextSelected: {
    color: '#2e7d32',
    fontWeight: '600',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
  },
  // Only ever inside `formActions`' row, where `flex: 1` splits the width
  // evenly between Save and Cancel. It deliberately isn't on `button` itself:
  // the standalone "Add Planting" button is a direct child of the screen's
  // own column, and there `flex: 1` grows *vertically*, stretching the button
  // down the whole scroll view (and squashing it below its padding once the
  // Plantings list overflows).
  formActionButton: {
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
  listRow: {
    paddingVertical: 8,
  },
  // Deliberately light. It has to read as "the screen is waiting on you"
  // without hiding the map, since the ring identifying the tapped Pins is
  // drawn up there and is half the point of the sheet.
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  sheetBackdropTouch: {
    flex: 1,
  },
  optionDetail: {
    color: '#666',
    fontSize: 13,
    marginTop: 2,
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    // Clears the home indicator on a notched phone, where the sheet sits
    // outside SafeAreaView's own insets.
    paddingBottom: 40,
    gap: 12,
  },
})
