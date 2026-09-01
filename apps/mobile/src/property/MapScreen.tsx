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
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Polygon } from 'react-native-svg'
import type { MainStackParamList } from '../navigation/types'
import { usePlantsRepository } from '../plants/PlantsRepositoryContext'
import { usePlantingsRepository } from '../plantings/PlantingsRepositoryContext'
import { useBedsRepository } from './BedsRepositoryContext'
import { NativeBaseMap } from './NativeBaseMap'
import { draggedStagePoint, mapDisplayScale } from './mapSurface'
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
/** The same courtesy for the marker being dragged — more so, since grabbing it is the whole interaction, and a finger covers it completely while dragging. */
const NEW_PIN_TAP_RADIUS_PX = 22

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

  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [pinStage, setPinStage] = useState<BedPoint>(CENTER_OF_SURFACE)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const { width } = useWindowDimensions()
  const displayScale = mapDisplayScale(width - SCREEN_PADDING * 2)
  const surfaceSize = STAGE_SIZE_PX * displayScale

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
  const drop = useMemo(
    () =>
      pixelsPerFootValue === null ? null : resolvePinDrop(pinStage, pixelsPerFootValue, outlines),
    [pinStage, pixelsPerFootValue, outlines],
  )

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
        },
        // No release/terminate handler on purpose. Web's Konva marker needs
        // one because it resolves the drop imperatively on `dragend`; here
        // the resolved Bed is derived from `pinStage` (see `drop` above), so
        // the last move frame has already settled it — an OS-terminated
        // gesture leaves the Pin correctly resolved where it stopped.
        onPanResponderMove: (_event, gesture) => {
          setPinStage(draggedStagePoint(dragStartRef.current, gesture.dx, gesture.dy, displayScaleRef.current))
        },
        // The map sits inside a ScrollView, which asks to take over any
        // gesture that starts to look like a scroll. Refusing keeps a
        // downward drag of the Pin a drag of the Pin.
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }),
    [],
  )

  function handleStartAdding() {
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
                    onPress={() =>
                      navigation.navigate('PlantingDetail', { plantingId: planting.id })
                    }
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
        <Text>
          {drop?.bed
            ? `Pin is in ${drop.bed.name}.`
            : 'Drag the pin onto a Bed to place this Planting.'}
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
            style={[styles.button, (saving || !form.plantId || !drop?.bed) && styles.buttonDisabled]}
            disabled={saving || !form.plantId || !drop?.bed}
            onPress={handleSave}
          >
            <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save Planting'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={styles.buttonSecondary}
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
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Map</Text>
          <Pressable accessibilityRole="button" onPress={() => navigation.goBack()}>
            <Text style={styles.backLink}>Back to Dashboard</Text>
          </Pressable>
        </View>
        {loadError && <Text style={styles.error}>{loadError}</Text>}
        {renderBody()}
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
  button: {
    backgroundColor: '#2e7d32',
    borderRadius: 4,
    padding: 12,
    alignItems: 'center',
    flex: 1,
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
    flex: 1,
  },
  listRow: {
    paddingVertical: 8,
  },
})
