# Spec: Personal Garden Plant Registry

## Problem Statement

The user maintains a home garden with 50–100 plantings and repeatedly loses track of what they've planted, especially after winter dormancy erases visual and memory cues. Specifically, they:

- Forget what a plant looks like once it's dormant or before it's identifiable
- Forget when a plant typically blooms
- Forget whether a plant needs periodic care (e.g. a Chelsea chop) and when that care is due
- Struggle to plan which plants will bloom together or in sequence within the same bed
- Currently rely on a separate external app for color-wheel/companion planning
- Forget what year a plant was acquired and where it came from
- Have no single place to capture and be reminded of garden todos

## Solution

A personal garden registry app with two linked entities — a reusable **Plant** (species/variety-level facts that don't change) and a **Planting** (a specific placement of that plant in the garden, which may represent a cluster of individuals). The app provides:

- A **map** of the garden, built from scaled bed drawings created on desktop, onto which Plantings are pinned (on desktop or phone) with optional landmark-distance guidance for precision
- A **bloom timeline** to visualize what's blooming together or in sequence, filterable by garden area
- A **registry** — a searchable/filterable list of Plants, linking out to their map location(s)
- **Recurring and one-off tasks**, defined once per Plant and applying to all its Plantings, with logged completion history
- A **dashboard** home screen that surfaces Map, Registry, and Timeline without forcing tasks to the front

## User Stories

1. As a gardener, I want to record a Plant's common name, scientific name, and cultivar, so that I can identify it even when I've forgotten its details.
2. As a gardener, I want to attach one or more reference photos to a Plant, so that I can recognize what it looks like when dormant or unfamiliar.
3. As a gardener, I want to record a Plant's flower color, so that I can plan color combinations without a separate app.
4. As a gardener, I want to record a Plant's bloom window (start and end), so that I know roughly when to expect flowers.
5. As a gardener, I want to record a Plant's sun/shade requirement, so that I know where it can be placed.
6. As a gardener, I want to record a Plant's mature height and spread, so that I can plan spacing.
7. As a gardener, I want to record a Plant's USDA hardiness zone, so that I know if it will survive my climate.
8. As a gardener, I want to record whether a Plant is deciduous or evergreen, so that I know what to expect it to look like across seasons.
9. As a gardener, I want to record whether a Plant is native or non-native, so that I can make informed planting decisions.
10. As a gardener, I want to define recurring care tasks on a Plant (e.g. Chelsea chop, fertilizing), so that every Planting of that species inherits the same care guidance without re-entering it.
11. As a gardener, I want a care task to support a fixed calendar date range trigger (e.g. "April 1–15"), so that time-bound tasks are scheduled automatically.
12. As a gardener, I want a care task to support a freeform seasonal-marker trigger (e.g. "when new growth is 6 inches"), so that judgment-based tasks are still captured as reminders even without a computed date.
13. As a gardener, I want to log a Planting as a specific instance of a Plant, so that I can track where and how many of that species exist in a given spot.
14. As a gardener, I want a Planting to support a quantity, so that a cluster of many individuals (e.g. 24 crocus bulbs) is recorded as one record, not one per bulb.
15. As a gardener, I want to create multiple separate Plantings of the same Plant in different areas of the garden, so that far-apart instances are tracked independently.
16. As a gardener, I want to record the year a Planting was acquired, so that I can recall how long it's been in the ground.
17. As a gardener, I want to record the source/nursery a Planting came from, so that I can recall where I bought it, even if I bought the same species from different places over time.
18. As a gardener, I want to attach a dated photo log to a Planting, so that I can see how that specific instance has changed or spread over the years.
19. As a gardener, I want to draw a scaled grid map of a garden area on desktop, so that I have an accurate spatial representation of that area.
20. As a gardener, I want to use freehand and shape-based tools on desktop to draw bed outlines, so that the map resembles the real shape of my beds.
21. As a gardener, I want to tie the map's grid scale to a real-world measurement, so that distances on the map reflect real distances in the garden.
22. As a gardener, I want to tag one or more landmark points (e.g. fence post, house corner) within a bed during desktop creation, so that pin placement can be measured relative to something identifiable.
23. As a gardener, I want to place a Planting pin on the map from my phone by tapping roughly where it is, so that I can quickly record location while walking the garden.
24. As a gardener, I want the option to enter a distance from a tagged landmark when placing a pin, so that the pin's position is accurate to within about a foot.
25. As a gardener, I want pin placement (rough or landmark-guided) to work identically on desktop and phone, so that I'm not restricted to one device for this task.
26. As a gardener, I want bed/area creation to be desktop-only, so that I'm not forced to freehand-draw precise shapes on a touchscreen, which is difficult.
27. As a gardener, I want to view a bloom timeline showing each Plant's bloom window as a bar across the year, so that I can see which plants bloom together or in sequence.
28. As a gardener, I want to filter the bloom timeline by garden area, so that I can plan bloom sequencing within a specific bed.
29. As a gardener, I want to view bloom information as a month-filtered list, as an alternative to the timeline, so that I can quickly check what's blooming in a given month.
30. As a gardener, I want a searchable and filterable registry list of all my Plants (by name, color, bloom month, sun/shade, etc.), so that I can answer questions like "what do I have that's shade + purple + blooms in June."
31. As a gardener, I want each registry entry to link to its location(s) on the map, so that I can find where a Plant is physically planted from its record.
32. As a gardener, I want a home/dashboard screen with quick access to Map, Registry, and Timeline, so that I can get to whichever mode I need without task lists forced on me.
33. As a gardener, I want overdue and upcoming tasks to be reachable but not shown immediately on opening the app, so that the app doesn't feel task-nagging when I just want to browse or plan.
34. As a gardener, I want to add one-off manual todos outside the recurring task system, so that I have a single central place for all garden reminders.
35. As a gardener, I want completed recurring tasks to be logged with a done/missed status per year per Planting, so that I can review care history over time.
36. As a gardener, I want to view a Planting's task history, so that I can recall whether and when I last performed a given care action on it.

## Implementation Decisions

- **Two-entity data model**: `Plant` (species/variety-level, reusable) and `Planting` (instance-level, one record per placement decision). Plantings reference exactly one Plant. A cluster of many individual specimens placed together is one Planting with a `quantity` field, not one record per specimen.
- **Plant fields**: common name, scientific name, cultivar, flower color, bloom window (start date, end date), sun/shade requirement, mature height/spread, USDA hardiness zone, deciduous/evergreen, native/non-native, reference photo(s) (at least one expected), recurring care-task templates.
- **Planting fields**: reference to Plant, quantity, map location (bed + pin coordinates, optionally a distance-from-landmark value), year acquired, source/nursery, dated photo log.
- **No per-Planting task overrides**: task timing is defined once on the Plant and applies uniformly to all its Plantings. This was explicitly evaluated and rejected as not worth the added complexity.
- **Task model**: task templates belong to Plant. Two trigger types are in scope: (1) fixed calendar date range, (2) freeform seasonal-marker text (a reminder note with no computed date). Bloom-fade-relative triggers (a task scheduled relative to a biological event like "after blooms fade") and any check-in/nudge mechanism to log that event are explicitly out of scope for this spec.
- **Task completion**: logged per Planting per year with a done/missed status, forming a history the user can review.
- **Map/bed creation**: desktop-only. Supports freehand tracing and shape-based tools (rectangle/oval), scaled against a real-world measurement the user provides (not derived from photos or GPS). Each bed must support tagging one or more landmark points during creation.
- **Map/pin placement**: available on both desktop and phone. A pin can be placed by rough tap alone, or refined via an optional "distance from a tagged landmark" input, which is offered inline at the point of placing/editing a single pin — not as a separate guided or multi-step mode, and never triggered proactively/unprompted.
- **No photo-based or GPS-based mapping.** This was evaluated and explicitly rejected: consumer GPS accuracy (~10–16 ft) doesn't meet the target accuracy (~1 ft), and photographing real garden terrain introduces perspective distortion that a single two-point calibration can't correct for across an entire bed, especially when only eye-level (non-elevated) photo angles are available.
- **No phone-based bed drawing.** Freehand/shape drawing of bed outlines is desktop-only; touchscreen freehand tracing was evaluated and rejected as impractical for precise outlines.
- **Bloom timeline**: horizontal year-view visualization, one bar per Plant spanning its bloom window, filterable by garden area. A month-filtered list view is a secondary presentation of the same underlying bloom-window data (no separate data model needed).
- **Registry view**: a filterable/searchable list over Plant fields (name, color, bloom month, sun/shade, etc.), with each entry linking to its associated Planting location(s) on the map.
- **Dashboard/home screen**: presents quick navigation into Map, Registry, and Timeline. Task lists are intentionally not surfaced immediately on open; up to 2–3 taps of navigation to reach any part of the app is acceptable.
- **Data persistence (local vs. cloud-synced)**: explicitly undecided. Deferred until the core data shape and screens are validated.
- **Single module/seam**: as this is a new, standalone application with no existing codebase, there is one seam: the application itself. No existing modules to integrate against.

## Testing Decisions

- No existing codebase or test suite exists yet — there is no prior art within this project to follow.
- Tests should verify external behavior, not implementation details: e.g. "creating a Planting with quantity 24 produces one record with quantity=24, not 24 records," "a Plant's task template appears as an inherited task on every Planting referencing that Plant," "a bloom timeline bar's start/end matches the Plant's bloom window," "a task marked done is reflected in that Planting's history for the correct year."
- Core areas needing coverage once implementation begins: the Plant/Planting relationship and cascading of task templates, task trigger evaluation (date-range vs. seasonal-marker), map scale/landmark-distance-to-pin-position calculations, and registry filter correctness.

## Out of Scope

- Color-wheel / companion-planting color-harmony engine
- Per-Planting task timing overrides
- Bloom-fade-relative task triggers and any "how do the blooms look now?" check-in/nudge mechanism
- Logging the actual date of biological events (e.g. actual bloom-fade date) per year
- Photo-based or GPS-based map creation
- Phone-based freehand or shape-based bed/area drawing
- Cloud sync vs. local-only storage decision (to be made later)

## Further Notes

- This spec was produced through an extended grilling/interview session (10 rounds) rather than a single upfront brief; several decisions reversed or narrowed mid-session (e.g. map creation moved from "photo-based" → "hand-drawn grid" → "desktop-only drawing + guided phone pin placement" as feasibility was discussed with the user). The final decisions above supersede any earlier framing discussed in that conversation.
- No project repository or issue tracker was available in this environment, so this spec has been written to a file rather than published to a tracker. Run the project's tracker setup (`/setup-matt-pocock-skills`) and re-publish, or hand this file directly to an implementing agent.
