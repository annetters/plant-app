# CONTEXT.md — Personal Garden Plant Registry

## Glossary

### Plant
A species- or variety-level record. Fields: common name, scientific name,
cultivar, flower color, bloom window, sun/shade requirement, mature height
and spread, USDA hardiness zone, deciduous/evergreen, native/non-native,
reference photos, and care task templates. One Plant record may underlie
many Plantings. Never use "plant" to mean both Plant and Planting.

### Planting
A specific placement decision: one cluster of a given Plant at a given
location in the garden. Fields: reference to Plant, quantity, map location
(bed + pin coordinates), year acquired, source/nursery, dated photo log.
A Planting with quantity 24 = one record for 24 specimens, not 24 records.

### Bed
A drawn map area representing a physical garden section. Desktop-only
creation. Has a name, a drawn outline stored as the raw traced point list
(freehand or shape-based), a smoothing flag, a grid scale
(pixels-per-real-world-unit), and zero or more Landmarks.

The outline is stored raw and smoothed on render, never the other way round —
see ADR-0001. Landmarks are optional: a Pin placed by rough tap needs none.

*Open:* whether grid scale belongs on the Bed at all. When an aerial base
layer is in use the scale is derived once from latitude and tile zoom
(ADR-0002), so every Bed on that base shares it and a per-Bed scale could let
two Beds disagree about the length of a foot. Per-Bed scale may still be
right for the blank-canvas fallback path.

### Landmark
A named reference point tagged within a Bed during creation (e.g. "fence
post NE corner"). Used as an anchor for precise Pin placement.

### Pin
A map marker for a Planting's location within a Bed. Placed by rough tap,
or refined with a distance measurement from a Landmark.

### Bloom window
A Plant's typical flowering period, stored as start and end month/day
(year-independent). Displayed as bars on the Bloom Timeline.

### Care task template
A recurring care instruction defined on a Plant, inherited by all its
Plantings. Has a name and a trigger. Not overridable per Planting.

### Task trigger
The scheduling mechanism for a care task template. Two types only:
- **Date-range**: fixed calendar window (e.g. "April 1–15"), auto-computed.
- **Seasonal-marker**: freeform reminder text, no computed date.

### Task completion
A log entry (done or missed) keyed by Care task template, Planting, and
calendar year. All three are needed: a Plant with three Care task templates
produces three Task completions per year for each of its Plantings. Forms a
reviewable care history per Planting.

### One-off todo
A manual, non-recurring reminder outside the care task template system.

### Registry
The searchable, filterable Plant list. Filter axes: name, flower color,
bloom month, sun/shade, and other Plant fields. Each entry links to its
Planting location(s) on the map.

### Bloom Timeline
Year-view bar chart of Plant bloom windows, filterable by Bed. A
month-filtered list view is a secondary presentation of the same data —
no separate data model.

### Dashboard
The home screen. Quick access to Map, Registry, and Bloom Timeline. Task
lists not surfaced immediately — reachable within 2–3 taps.
