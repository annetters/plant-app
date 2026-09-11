# Garden Planner — Product & Technical Specification (V1)

> # ⚠️ This document is an opinion. It is not instructions.
>
> **Do not implement against this file.** It is a third-party proposal received
> from the developer team on 2026-09-10. On **2026-09-11 the product owner ruled
> on its status**: the existing product stands, and **nothing in this document is
> adopted unless the user approves that specific thing, case by case**. It is
> *input to* decisions. It is never itself a decision, and it grants no
> permission to change anything.
>
> ## You may propose. You may not adopt.
>
> If something here looks like an improvement, **say so and stop**. Whether a
> section of this document is "better" than what exists is the **user's**
> judgement, not the reader's. An agent that decides for itself that a proposal
> is an improvement and implements it has taken a product decision that was not
> its own — and this document is dense with plausible-sounding, load-bearing
> proposals that would quietly change what the app is.
>
> The correct move, every time: name what the section proposes, what it would
> cost, what it would change or reverse, and **wait for an answer**. Silence is
> not approval. Approval of one section is not approval of the next.
>
> **Adopted so far: ADR-0008 only** (the layered-Maps model and the
> calibration/display-transform split, from §7–9). Everything else in this file
> is unadopted.
>
> **Ignore the document's own voice.** It uses MUST, MUST NOT, SHOULD and
> "authoritative" throughout, and §3 addresses "the implementation agent"
> directly, as though this repo had adopted it. It has not. Those words carry the
> author's intent, not this project's authority. Nothing in this file obliges
> anyone to do anything.
>
> **It describes a different product.** This is a Figma-style garden *design*
> editor — saved versions, snap-to-grid, undo/redo, an inspector panel. The app
> is a plant *registry* — bloom timeline, Tag Scan, photos, the Registry and its
> filters, none of which this document mentions even once. The two overlap on
> Property, Map and Bed and diverge nearly everywhere else.
>
> **Order of authority in this repo, highest first:**
>
> 1. An explicit decision by the user.
> 2. `CONTEXT.md` and `docs/adr/`.
> 3. Open issues on the tracker.
> 4. **This file.**
>
> Where this file disagrees with anything above it, the thing above wins. No
> reconciliation is needed and no permission is required to disregard it.
>
> **Before acting on any section, read the Reconciliation notes at the bottom.**
> They catalogue every conflict found so far, including two where this document
> argues against decisions the user has already made deliberately.
>
> Section numbering and heading levels are reproduced verbatim, including the
> source's own inconsistency at §1. An earlier three-section extract circulated
> with *different* numbering and at least one contradictory rule; it has been
> deleted, and the notes at the bottom explain why it should not be trusted.

---

## 1. Product Definition

Garden Planner is an application for documenting and designing a physical **Property**.

The application allows a user to:

* Define a Property and its dimensions.
* Import one or more reference Maps.
* Calibrate Maps to the Property's real-world coordinate system.
* Create multiple Garden Versions.
* Define persistent garden Beds whose geometry can differ between Garden Versions.
* Maintain a Plant Catalog.
* Maintain an inventory of Owned Plants.
* Place Owned Plants within Garden Versions.
* Visualize mature plant size.
* Edit Beds and Plants directly on a Figma/Photoshop-style canvas.
* Use a coordinate-based Grid and Snap system.
* Undo and redo editing operations.
* Automatically persist changes.

The application is a **garden planner**, not a general-purpose CAD, GIS, architecture, or vector-editing application.

### Product boundary

The V1 architecture MUST remain focused on garden planning.

The following are explicitly outside the intended scope of V1:

* Full architectural modeling.
* Editable architectural CAD.
* Complex house or driveway modeling.
* GIS parcel boundaries.
* GPS-based placement.
* BLE/UWB positioning.
* Terrain modeling.
* Irrigation engineering.
* Advanced sun/shadow simulation.
* Automated garden design.
* AI-generated landscape plans.
* General-purpose vector drawing.
* Arbitrary image-object editing.
* Collaborative real-time editing.
* Dedicated Container entities.

---

# 2. Technology Stack

| Layer                   | Technology                         | Requirement |
| ----------------------- | ---------------------------------- | ----------- |
| Frontend                | React                              | MUST        |
| Language                | TypeScript                         | MUST        |
| Canvas/editor           | Konva / react-konva                | MUST        |
| Backend                 | Supabase                           | MUST        |
| Database                | PostgreSQL                         | MUST        |
| Authentication/security | Supabase Auth/RLS where applicable | SHOULD      |

Konva/react-konva is the **rendering and interaction layer**. It MUST NOT become the authoritative domain model.

---

# 3. Implementation Strategy for the Existing Codebase

> ⚠️ **Not addressed to you.** This section speaks to "the implementation
> agent" as if this repo had adopted the document. It has not — see the
> header. Its MUSTs are the author's, and confer no obligation here. The
> reconciliation *vocabulary* below (Compatible, Adaptable, Migration
> Required, Architectural Conflict, Specification Ambiguity, Existing
> Implementation Superior) is genuinely useful and is borrowed by ADR-0008;
> the instructions around it are not in force.

This project has already been started.

The implementation agent MUST NOT assume that the existing architecture should be discarded and rebuilt.

Before making major changes, the implementation agent MUST inspect:

1. The existing codebase.
2. Existing application architecture.
3. Existing state management.
4. Existing Supabase schema.
5. Existing Supabase migrations.
6. Existing authentication and RLS.
7. Existing Property model.
8. Existing Map model.
9. Existing Garden Version model.
10. Existing Bed model.
11. Existing Plant model.
12. Existing Placement model.
13. Existing coordinate system.
14. Existing Konva/editor architecture.
15. Existing reusable UI components.

The implementation agent MUST compare the existing implementation against this specification.

### Reconciliation categories

Each discrepancy SHOULD be classified as one of:

* **Compatible** — existing implementation already satisfies the specification; preserve it.
* **Adaptable** — existing implementation can satisfy the specification with limited changes.
* **Migration Required** — database/data changes are required.
* **Architectural Conflict** — existing implementation conflicts with a core domain rule and requires refactoring.
* **Specification Ambiguity** — product-defining behavior is genuinely unresolved; stop and ask.
* **Existing Implementation Superior** — existing implementation differs from this document but provides a clearly better implementation without violating domain invariants; preserve it and document the deviation.

Naming differences alone are NOT architectural conflicts.

### Implementation Reconciliation Report

Before major architectural changes, the implementation agent SHOULD produce an internal reconciliation report containing:

* Existing Stack
* Existing Domain Model
* Existing Coordinate Model
* Existing Map Model
* Existing Database
* Compatibility Assessment
* Conflicts
* Required Migrations
* Reusable Components
* Required Refactors
* Existing Implementation Decisions Worth Preserving
* Open Decisions
* Recommended Implementation Order

The goal is to evolve the existing application safely, not blindly rewrite it.

---

# 4. Core Domain Model

The primary domain entities are:

```text
Property
├── Property Maps
├── Garden Versions
├── Beds
│   └── Bed Geometry per Garden Version
└── Owned Plants
    └── Plant Placements per Garden Version

Plant Catalog
```

The primary database tables are:

```text
properties
property_maps
garden_versions
beds
bed_geometries
plant_catalog
owned_plants
plant_placements
```

Additional tables MAY be introduced when necessary, but MUST NOT be introduced merely to add complexity or speculative functionality.

---

# 5. Property

A **Property** is the persistent physical coordinate space in which garden planning occurs.

A Property represents the real-world area being planned.

## 5.1 V1 geometry

V1 Properties are rectangular.

Complex property boundaries are out of scope.

## 5.2 Property dimensions

The Property MUST have:

* Width.
* Depth.

Dimensions SHOULD be stored using integer inches.

Example:

```text
width_inches = 282
depth_inches = 204
```

This represents:

```text
23' 6" × 17' 0"
```

## 5.3 Property coordinate system

The Property has a permanent coordinate system.

The coordinate origin is:

```text
Southwest Property corner = (0, 0)
```

Axes:

```text
X → East
Y → North
```

Coordinates use **1-inch precision**.

Example:

```text
(282, 204)
```

means:

```text
23' 6" east
17' 0" north
```

## 5.4 Coordinate authority

Property/world coordinates are authoritative.

Screen coordinates and Konva coordinates are temporary representations only.

The application MUST provide transformations between:

```text
Property/world coordinates
        ↕
Screen/Konva coordinates
```

Zoom, pan, viewport dimensions, and screen resolution MUST NOT change persisted world coordinates.

---

# 6. Property Database Model

Conceptual schema:

```text
properties
    id
    user_id
    name
    width_inches
    depth_inches
    coordinate_system_definition
    created_at
    updated_at
```

The exact implementation MAY differ if the existing database already provides equivalent functionality.

---

# 7. Maps

A **Map** is a reference image or plan associated with a Property.

Examples include:

* Aerial imagery.
* Survey plot plans.
* Landscaping plans.
* User-created drawings.

Maps are reference assets.

A Map is **not the garden**.

## 7.1 Multiple Maps

A Property MAY have multiple Maps.

Examples:

```text
Property
├── Aerial Map
├── Survey
└── Landscape Plan
```

## 7.2 Map coordinate independence

Garden objects MUST NOT use Map-specific coordinates as their authoritative location.

Garden objects use Property/world coordinates.

Therefore:

* Maps can be swapped.
* Maps can be hidden.
* Maps can be transformed.
* Maps can be recalibrated according to supported workflows.

None of these operations should inherently change the garden object's world coordinates.

## 7.3 Map editing

V1 supports:

* Rotation.
* Crop.
* Scale.
* Position.
* Opacity.

Map transformations MUST be non-destructive.

The original source image MUST remain unchanged.

### Crop

Crop SHOULD be represented as rendering/clipping metadata rather than destructive image modification.

---

# 8. Map Calibration

Calibration establishes the relationship between Map image coordinates and Property/world coordinates.

Calibration and display transformation are separate concepts.

## 8.1 Calibration

Calibration establishes:

```text
Map image coordinates
        ↓
Calibration relationship
        ↓
Property/world coordinates
```

## 8.2 Display transform

The display transform controls how the calibrated Map is displayed.

It can include:

* Position.
* Rotation.
* Scale.
* Crop.
* Opacity.

Changing the display transform MUST NOT change the Property coordinate system.

For example, rotating a calibrated Map MUST NOT rotate the Property.

Moving a Map on the canvas MUST NOT move Plants or Beds.

## 8.3 V1 calibration workflow

The intended workflow is:

1. Import Map.
2. Rotate and/or crop as necessary.
3. Identify a known reference point or line.
4. Enter its known real-world dimension or position.
5. Derive the Map-to-Property scale/calibration.
6. Preview the alignment.
7. Save the calibrated Map.

V1 uses **manual calibration**.

GIS functionality is out of scope.

---

# 9. Property Map Database Model

Conceptual schema:

```text
property_maps
    id
    property_id
    name
    source_asset
    calibration
    transform
    crop
    opacity
    created_at
    updated_at
```

The exact representation of `calibration`, `transform`, and `crop` MAY vary.

The important domain requirement is that calibration and display transformation remain conceptually separate.

---

# 10. Garden Versions

A **Garden Version** represents a complete garden design state for a Property.

A Garden Version serves two purposes:

1. Historical snapshot.
2. Alternate or future design.

A version can represent something that:

* Was physically implemented.
* Was previously implemented.
* Is currently being considered.
* Was only an idea and never physically implemented.

## 10.1 Version contents

Different Garden Versions MAY contain different:

* Plants.
* Plant quantities.
* Plant locations.
* Bed shapes.
* Beds.
* Bed participation.
* Other garden design decisions.

## 10.2 Version independence

Garden Versions are independent design states.

Duplicating a Garden Version MUST create an independently editable copy.

Editing a duplicated version MUST NOT modify the source version.

## 10.3 Version duplication

When a Garden Version is duplicated:

### Create new records

* New Garden Version ID.
* New version-specific Bed Geometry records.
* New Plant Placement records.

### Reuse existing records

* Same Property.
* Same Maps.
* Same Plant Catalog records.
* Same Owned Plants.
* Same persistent Bed identities.

Conceptually:

```text
Version A
    Bed A
        Geometry A1
    Plant A
        Placement A1

Duplicate

Version B
    Bed A
        Geometry B1
    Plant A
        Placement B1
```

`Bed A` and `Plant A` remain the same persistent entities.

`Geometry A1` / `Geometry B1` and `Placement A1` / `Placement B1` are independent records.

---

# 11. Garden Version Database Model

Conceptual schema:

```text
garden_versions
    id
    property_id
    name
    created_from_version_id
    created_at
    updated_at
```

Formal statuses such as:

```text
current
draft
archived
```

are NOT required for V1 unless a concrete product workflow requires them.

---

# 12. Editor State vs. Garden Data

Editor state is separate from Garden Version design data.

The following MUST NOT belong to a Garden Version:

* Zoom.
* Pan.
* Selected object.
* Active tool.
* Placement mode.
* Grid visibility.
* Grid spacing.
* Snap enabled/disabled.
* Snap increment.
* Mature-size visualization.
* Temporary interaction state.

These are editor/session settings analogous to Figma or Photoshop.

They affect how the user views or edits the design, not what the design fundamentally is.

---

# 13. Beds

A **Bed** is a persistent garden-area identity on a Property.

### Critical rule

**A Bed stays the same.**

The Bed identity persists even when its geometry changes between Garden Versions.

A Bed MAY:

* Exist in Version A.
* Be absent from Version B.
* Have a different shape in Version C.
* Be renamed.
* Be reshaped.
* Be moved within a Garden Version.

None of these actions changes the Bed's identity.

## 13.1 Bed identity

Each Bed has an immutable UUID.

The UUID MUST NOT change when:

* The Bed is renamed.
* The Bed is moved.
* The Bed is reshaped.
* The Bed is added to a Garden Version.
* The Bed is removed from a Garden Version.

## 13.2 Removing a Bed from a Version

"Remove Bed from Garden Version" means:

> This Bed is absent from that design.

It does **not** mean:

> Delete this Bed from the Property.

Historical versions MUST remain capable of referencing the persistent Bed identity.

---

# 14. Bed Geometry

Bed geometry is version-specific.

Conceptually:

```text
beds
    id
    property_id
    name

bed_geometries
    id
    bed_id
    garden_version_id
    polygon
```

The Bed is persistent.

The Bed Geometry is specific to a Garden Version.

Therefore:

```text
Bed A
├── Version 1 → Geometry A
├── Version 2 → Geometry B
└── Version 3 → Geometry C
```

Each geometry uses Property/world coordinates.

## 14.1 Editing Bed Geometry

"Edit Bed Geometry" is the formal domain operation.

The UI MAY describe this as:

* Move Bed.
* Reshape Bed.
* Edit Bed.

Editing Bed Geometry MUST NOT automatically move Plant Placements.

---

# 15. Plant Model

Plants are represented using three distinct concepts.

## 15.1 Plant Catalog

A Plant Catalog record defines what a plant type is.

Potential attributes include:

* Scientific name.
* Common name.
* Cultivar.
* Mature height.
* Mature width.
* Mature depth.
* Recommended spacing.
* External source.
* External source ID.

USDA integration MAY be supported architecturally for future use, but it is not a V1 requirement.

## 15.2 Owned Plant

An Owned Plant represents a specific plant the user owns.

Example:

```text
Plant Catalog:
Dahlia 'Cafe au Lait'

Owned Plants:
Cafe au Lait #1
Cafe au Lait #2
```

An Owned Plant MAY exist without being planted.

This is important because the application also functions as an inventory of plants the user owns.

Removing a plant from a garden does NOT delete the Owned Plant.

## 15.3 Plant Placement

A Plant Placement represents where an Owned Plant is located in a particular Garden Version.

Conceptually:

```text
plant_placements
    id
    garden_version_id
    owned_plant_id
    bed_id
    center_x
    center_y
    created_at
    updated_at
```

A Plant Placement is version-specific.

The same Owned Plant MAY have different placements in different Garden Versions.

---

# 16. Plant Coordinates

The plant's center point is the authoritative location.

```text
center_x
center_y
```

are stored in Property/world coordinates.

The center MUST NOT be stored as a screen/Konva coordinate.

Example:

```text
Owned Plant: Cafe au Lait #1

Version A:
    center = (120, 84)

Version B:
    center = (156, 96)
```

The Owned Plant remains the same physical inventory item.

The Placements are different.

---

# 17. Plant Size and Footprints

Plant height, width, and depth are metadata.

Use the following terminology:

* `mature_height`
* `mature_width`
* `mature_depth`

Here, **mature depth means horizontal front-to-back spread**, not root depth or soil depth.

The mature footprint is visualized around the Plant Placement's center.

Example:

```text
             mature width
        <------------------->
              _________
            /           \
           /             \
          |       ●       |
           \             /
            \___________/

                center
```

The center point remains authoritative.

## 17.1 Overlap

Plants MAY visually overlap or touch.

The application MUST NOT enforce hard collision prevention.

The application MAY:

* Display spacing measurements.
* Display warnings.
* Indicate potentially crowded planting.

But it MUST NOT prevent the user from intentionally overlapping plant footprints.

---

# 18. Bed Membership

Plants are **not children of Beds**.

A Plant Placement MAY have an explicit:

```text
bed_id
```

This represents the current Bed assignment.

`bed_id` MAY be null.

A plant may therefore exist:

* Inside a Bed.
* Outside a Bed.
* Between Beds.
* In a lawn.
* In a container.
* Anywhere else within the Property.

## 18.1 Geometry vs. membership

Geometric containment is a validation/recommendation mechanism.

It is NOT a competing source of truth.

If a Bed is moved or reshaped and a Plant Placement ends up outside the assigned Bed:

* Do NOT automatically move the plant.
* Do NOT automatically rewrite `bed_id`.
* Do NOT silently remove the Bed assignment.

Instead, the application SHOULD display a warning such as:

> This plant is outside the assigned bed.

---

# 19. Containers

Dedicated Container entities are out of scope for V1.

A potted plant can be represented as:

```text
Owned Plant
+
Plant Placement
+
bed_id = null
```

This provides sufficient V1 functionality without introducing an unnecessary domain model.

---

# 20. Plant Catalog Database Model

Conceptual schema:

```text
plant_catalog
    id
    scientific_name
    common_name
    cultivar
    mature_height
    mature_width
    mature_depth
    recommended_spacing
    external_source
    external_source_id
    created_at
    updated_at
```

---

# 21. Owned Plant Database Model

Conceptual schema:

```text
owned_plants
    id
    property_id
    plant_catalog_id
    name
    notes
    status
    created_at
    updated_at
```

The exact status model SHOULD remain minimal in V1.

---

# 22. Plant Placement Database Model

Conceptual schema:

```text
plant_placements
    id
    garden_version_id
    owned_plant_id
    bed_id
    center_x
    center_y
    created_at
    updated_at
```

---

# 23. Grid

The Grid is a dynamically generated visual aid based on the Property coordinate system.

It is NOT an image asset.

It MUST remain accurate across:

* Zoom.
* Pan.
* Screen size.
* Map changes.
* Map transformations.
* Garden Versions.

The Grid is generated from world coordinates and rendered into the current viewport.

---

# 24. Grid Spacing vs. Snap Increment

Grid spacing and Snap Increment are independent.

### Grid spacing

Controls the visual grid.

Possible values include:

```text
1'
2'
5'
10'
```

### Snap increment

Controls the precision to which an object is positioned.

Possible values include:

```text
1"
3"
6"
12"
```

The application MUST support 1-inch precision.

The user MAY therefore have:

```text
Grid spacing: 5'
Snap increment: 1"
```

These settings MUST remain independent.

---

# 25. Snap

When Snap is enabled:

1. User interacts with the canvas.
2. Screen coordinates are converted to world coordinates.
3. The resulting world coordinate is snapped to the configured increment.
4. The snapped world coordinate becomes the authoritative value.

Example:

```text
Raw world coordinate:
23' 6.7"

Snap increment:
1"

Stored coordinate:
23' 7"
```

Snap operates in world coordinates, not screen coordinates.

---

# 26. Editor Architecture

The editor follows this conceptual architecture:

```text
Persistent Domain State
        ↓
Application / Editor State
        ↓
Konva Rendering
```

Konva nodes represent domain objects visually, but Konva nodes are NOT the database model.

## 26.1 Suggested Konva layers

A reasonable V1 layer structure is:

```text
Map
Grid
Reference
Beds
Plants
Selection / Transform
Interaction / Overlay
```

The exact implementation MAY differ.

## 26.2 Source of truth

The application state/domain model is the source of truth.

The Konva scene graph MUST NOT become the authoritative storage mechanism.

---

# 27. Figma / Photoshop Interaction Model

When an interaction pattern is ambiguous, use familiar Figma/Photoshop conventions where they make sense.

The editor SHOULD support:

* Selection.
* Direct manipulation.
* Dragging.
* Inspector-based editing.
* Zoom.
* Pan.
* Visual selection state.
* Undo/redo.
* Distinct editing modes.

The application should feel like a visual design editor while remaining specifically focused on garden planning.

---

# 28. Plant Placement UX

**Click-to-place is the primary placement interaction.**

Drag-and-drop is a secondary desktop convenience.

## 28.1 Click-to-place workflow

1. User selects an Owned Plant from My Plants.
2. User enters Placement Mode.
3. User clicks/taps the desired location on the canvas.
4. Application converts screen coordinates to Property/world coordinates.
5. Application applies Snap if enabled.
6. Application creates a Plant Placement.
7. The new Placement becomes selected.
8. The Inspector becomes available.
9. Application returns to Select Mode unless the user explicitly continues placing.

## 28.2 Drag-and-drop workflow

1. User drags an Owned Plant.
2. User drops it on the canvas.
3. Application converts the drop position from screen to world coordinates.
4. Application applies Snap if enabled.
5. Application creates the Plant Placement.

Both workflows MUST ultimately create the same domain object.

---

# 29. Selection and Inspector

The canvas and Inspector MUST modify the same underlying application/domain state.

There MUST NOT be separate competing models for:

* Canvas editing.
* Inspector editing.

For example:

```text
User drags plant
        ↓
Update Plant Placement center
        ↓
Inspector displays new coordinate
```

or:

```text
User edits X coordinate in Inspector
        ↓
Update Plant Placement center
        ↓
Canvas renders new position
```

Both are editing the same Placement.

---

# 30. Undo / Redo

Undo/redo is an editor-session feature.

It does NOT need to persist across application reload/restart in V1.

Undo/redo SHOULD operate on meaningful domain operations.

Examples:

* Move Plant.
* Add Plant Placement.
* Remove Plant Placement.
* Move Bed.
* Reshape Bed.
* Add Bed to Version.
* Remove Bed from Version.
* Rename Bed.
* Transform Map.

## 30.1 Drag operations

A single continuous drag SHOULD be represented as one undoable operation.

The application MUST NOT create an undo entry for every pointer-move event.

For example:

```text
Drag Plant
    200 pointer events

Undo stack:
    1 × Move Plant
```

not:

```text
200 × Move Plant
```

---

# 31. Autosave and Persistence

The application SHOULD update application state immediately during editing.

Persistence to Supabase SHOULD be debounced.

The application MUST NOT write to the database on every pointer-move event during a drag.

Conceptually:

```text
User interaction
      ↓
Immediate local/application state update
      ↓
Debounced persistence
      ↓
Supabase
```

Undo/redo and autosave operate on the same underlying application state.

Undo is NOT equivalent to a database rollback.

---

# 32. Supabase and Database Rules

Supabase/PostgreSQL is the persistent backend.

The implementation MUST use a migration-based database workflow.

Existing migrations MUST be inspected before introducing schema changes.

Production schema MUST NOT be modified casually or manually when a migration is appropriate.

## 32.1 Security

Supabase Row Level Security SHOULD be used appropriately.

The frontend MUST NOT contain Supabase service-role or other secret keys.

If authentication and RLS already exist:

* Preserve them where compatible.
* Extend the existing security model.
* Do NOT create a parallel authentication/security system unnecessarily.

---

# 33. Referential Integrity

The conceptual relationships are:

```text
Map
    → Property

Garden Version
    → Property

Bed
    → Property

Bed Geometry
    → Bed
    → Garden Version

Owned Plant
    → Property
    → Plant Catalog

Plant Placement
    → Garden Version
    → Owned Plant
    → optional Bed
```

The database SHOULD prevent cross-Property relationships where practical.

For example, a Plant Placement for Property A should not reference an Owned Plant belonging to Property B.

---

# 34. Deletion and History

Historical garden data is important.

The application MUST distinguish between removing something from a design and deleting the underlying entity.

## 34.1 Plant

```text
Remove Plant Placement
≠
Delete Owned Plant
```

An Owned Plant can remain in inventory without a placement.

## 34.2 Bed

```text
Remove Bed from Garden Version
≠
Delete Bed
```

The persistent Bed remains available for other versions and historical context.

## 34.3 Historical data

Historical versions SHOULD be preserved.

An Owned Plant or Bed referenced by historical data MUST NOT be casually hard-deleted.

Where necessary, use an archive/soft-delete approach.

Permanent deletion is a destructive operation and requires appropriate dependency/history handling.

---

# 35. Database Overview

The intended conceptual database is:

```text
properties
property_maps
garden_versions
beds
bed_geometries
plant_catalog
owned_plants
plant_placements
```

### `properties`

```text
id
user_id
name
width_inches
depth_inches
coordinate_system_definition
created_at
updated_at
```

### `property_maps`

```text
id
property_id
name
source_asset
calibration
transform
crop
opacity
created_at
updated_at
```

### `garden_versions`

```text
id
property_id
name
created_from_version_id
created_at
updated_at
```

### `beds`

```text
id
property_id
name
created_at
updated_at
```

### `bed_geometries`

```text
id
bed_id
garden_version_id
polygon
created_at
updated_at
```

### `plant_catalog`

```text
id
scientific_name
common_name
cultivar
mature_height
mature_width
mature_depth
recommended_spacing
external_source
external_source_id
created_at
updated_at
```

### `owned_plants`

```text
id
property_id
plant_catalog_id
name
notes
status
created_at
updated_at
```

### `plant_placements`

```text
id
garden_version_id
owned_plant_id
bed_id
center_x
center_y
created_at
updated_at
```

The existing implementation MAY use different table/column names if it satisfies the same domain behavior.

---

# 36. Entity Identity Rules

| Entity          | Identity behavior                                 |
| --------------- | ------------------------------------------------- |
| Property        | Same Property across all Garden Versions and Maps |
| Property Map    | Same Map record regardless of Garden Version      |
| Garden Version  | New ID for every distinct version                 |
| Bed             | Persistent ID across Garden Versions              |
| Bed Geometry    | New/version-specific record                       |
| Plant Catalog   | Persistent catalog record                         |
| Owned Plant     | Persistent plant inventory record                 |
| Plant Placement | Version-specific record                           |

## 36.1 Critical duplication rule

Duplicating a Garden Version MUST NOT duplicate:

* Property.
* Property Maps.
* Plant Catalog records.
* Owned Plants.
* Persistent Bed identities.

Duplicating a Garden Version MUST create new:

* Garden Version.
* Bed Geometry records.
* Plant Placement records.

---

# 37. V1 Functional Scope

V1 includes:

### Property

* Property creation.
* Rectangular Property dimensions.
* Permanent Property coordinate system.
* 1-inch coordinate precision.

### Maps

* Multiple Maps.
* Map import.
* Manual calibration.
* Rotation.
* Crop/clip.
* Scale.
* Position.
* Opacity.
* Non-destructive transformations.

### Garden Versions

* Create versions.
* Duplicate versions.
* Independently edit duplicated versions.
* Preserve historical versions.

### Beds

* Persistent Bed identity.
* Add Beds to Garden Versions.
* Remove Beds from Garden Versions.
* Version-specific Bed Geometry.
* Move Beds.
* Reshape Beds.
* Preserve Bed identity across versions.

### Plants

* Plant Catalog.
* Owned Plants.
* Owned Plants without placements.
* Plant Placements.
* Version-specific placements.
* 1-inch placement precision.
* Bed assignment.
* Plants without Bed assignment.
* Mature-size visualization.

### Editor

* Select.
* Move.
* Click-to-place.
* Drag-and-drop placement.
* Inspector.
* Grid.
* Snap.
* Zoom.
* Pan.
* Undo.
* Redo.
* Autosave.

---

# 38. V1 Out of Scope

The following are explicitly out of scope:

* Full architecture modeling.
* Editable architectural CAD.
* Complex house geometry.
* Complex driveway geometry.
* GIS parcel boundaries.
* GPS-based placement.
* BLE positioning.
* UWB positioning.
* Terrain modeling.
* Irrigation engineering.
* Advanced sun/shadow simulation.
* Automated garden design.
* AI-generated landscape plans.
* Dedicated Container entities.
* Arbitrary image-object editing.
* General-purpose vector drawing.
* Collaborative real-time editing.

Future versions MAY address these areas, but they MUST NOT drive unnecessary V1 architectural complexity.

---

# 39. Critical Domain Invariants

> ⚠️ **"Authoritative" is the author's claim, not this project's status.**
> This list has no standing in this repo. Several items are already
> contradicted by decisions the user made knowingly — invariant 6 and
> invariant 7 by #41's aerial flatten and by beds turning with the aerial
> photo, invariants 13 and 14 by ADR-0009. Those are settled deviations, not
> defects to fix. See the Reconciliation notes at the bottom before treating
> any line here as a requirement.

The following rules are authoritative.

If an implementation decision conflicts with one of these rules, the implementation MUST be changed or the product decision must be explicitly revisited.

1. **Property/world coordinates are authoritative.**
2. **Screen/Konva coordinates are never authoritative.**
3. **Maps are reference assets, not the garden.**
4. **Garden objects are located using Property/world coordinates.**
5. **Map calibration is distinct from Map display transformation.**
6. **Map transformations are non-destructive.**
7. **Changing Map position, rotation, crop, or display scale does not move garden objects.**
8. **Bed identity persists on the Property.**
9. **Bed Geometry is version-specific.**
10. **Removing a Bed from a Garden Version does not delete the Bed.**
11. **Editing Bed Geometry does not move Plant Placements.**
12. **Plants are not children of Beds.**
13. **Plant `bed_id` represents explicit Bed assignment.**
14. **Geometric containment is validation/recommendation, not a competing source of truth.**
15. **Plant center coordinates are authoritative.**
16. **Plant footprints may overlap.**
17. **Owned Plants may exist without Placements.**
18. **Removing a Plant Placement does not delete the Owned Plant.**
19. **Garden Version duplication creates independently editable version-specific records.**
20. **Garden Version duplication does not duplicate Property, Maps, Plant Catalog, Owned Plants, or persistent Bed identities.**
21. **Editor settings are not Garden Version design data.**
22. **Zoom and pan cannot alter world coordinates.**
23. **The system supports 1-inch coordinate/placement precision.**
24. **Historical data must not be casually destroyed.**
25. **The V1 application must remain a garden planner rather than becoming CAD, GIS, or architecture software.**

---

# 40. Implementation Principles

The implementation agent SHOULD follow these principles throughout development.

## Preserve existing work

Do not rewrite existing code simply because a different architecture is described in this specification.

First determine whether the existing implementation can satisfy the domain requirements.

## Keep domain and rendering separate

Konva is the editor/rendering layer.

The database/domain model is the source of truth.

## Never persist screen coordinates

Screen/Konva coordinates are derived from world coordinates.

Never make them the authoritative persisted location.

## Keep Maps independent

Garden data must not become dependent on the current Map image or its screen transform.

## Keep Bed identity persistent

Do not create a new Bed identity simply because its geometry changes.

## Do not move plants when Beds move

Bed Geometry and Plant Placement are independent pieces of data.

## Do not silently change Bed membership

If a plant becomes geometrically disconnected from its assigned Bed, warn the user rather than silently modifying `bed_id`.

## Preserve history

Avoid destructive deletion when historical versions depend on the entity.

## Avoid speculative architecture

Do not build infrastructure for V2 features merely because they might eventually exist.

## Avoid general-purpose editor complexity

Use Figma/Photoshop conventions where helpful, but do not turn the garden planner into a general-purpose graphics editor.

## Prefer the least-complex valid implementation

When several implementations satisfy the specification, choose the simplest one.

## Do not invent product behavior

If a genuinely product-defining decision is missing and cannot reasonably be inferred, stop and ask.

Otherwise, make the least-complex reasonable implementation choice and document it.

---

# 41. Recommended Implementation Order

When implementing or reconciling the application, the recommended order is:

1. Inspect existing codebase and database.
2. Produce implementation reconciliation assessment.
3. Confirm/repair Property and world-coordinate model.
4. Confirm world-to-screen and screen-to-world transformations.
5. Confirm Map/calibration architecture.
6. Confirm Garden Version model.
7. Confirm persistent Bed identity and version-specific Bed Geometry.
8. Confirm Plant Catalog / Owned Plant / Plant Placement separation.
9. Confirm Placement coordinate model.
10. Implement Grid and Snap against world coordinates.
11. Implement selection and Inspector.
12. Implement Bed editing.
13. Implement Plant placement.
14. Implement Garden Version duplication.
15. Implement undo/redo.
16. Implement debounced persistence/autosave.
17. Validate historical-data behavior.
18. Validate RLS and cross-Property referential integrity.
19. Test critical invariants.
20. Record significant architecture decisions and deviations.

---

# 42. Testing Requirements

Testing SHOULD focus on domain invariants rather than only visual behavior.

At minimum, test:

### Coordinates

* Zoom does not alter persisted coordinates.
* Pan does not alter persisted coordinates.
* Screen-to-world conversion is accurate.
* World-to-screen conversion is accurate.
* 1-inch precision is preserved.

### Maps

* Map rotation does not move Plants.
* Map movement does not move Beds.
* Map scale changes do not modify world coordinates.
* Crop is non-destructive.
* Multiple Maps can coexist.

### Beds

* Bed UUID remains unchanged after editing.
* Bed Geometry differs correctly by Garden Version.
* Removing a Bed from a version does not delete the Bed.
* Moving a Bed does not move Plants.
* Reshaping a Bed does not move Plants.

### Plants

* Owned Plant can exist without Placement.
* Removing Placement preserves Owned Plant.
* Same Owned Plant can have different placements in different versions.
* Plant center remains authoritative.
* Plants may overlap.

### Versions

* Duplicating a version creates a new Version ID.
* Duplicated Bed Geometry has independent records.
* Duplicated Plant Placements have independent records.
* Property remains shared.
* Maps remain shared.
* Plant Catalog remains shared.
* Owned Plants remain shared.
* Bed identities remain shared.

### Editor

* A drag creates one undo operation.
* Undo/redo updates the same application state used by the Inspector and canvas.
* Autosave does not write every pointer-move event.

---

# 43. Definition of Architectural Success

The architecture is successful when the following statement remains true:

> The user can change how the garden is viewed, how a reference Map is displayed, how a Bed is shaped in one Garden Version, or where a plant is placed in another Garden Version without corrupting the underlying physical Property coordinate system or unrelated historical/design data.

The system should make the following concepts independently understandable:

```text
Physical Property
        ↓
Property coordinates

Reference Maps
        ↓
Calibration + display transform

Garden Versions
        ↓
Version-specific design state

Persistent Beds
        ↓
Version-specific Bed Geometry

Plant Catalog
        ↓
Owned Plants
        ↓
Version-specific Plant Placements

Editor
        ↓
View + interaction state
```

This separation is the core architectural principle of the application.

---
---

# Reconciliation notes

*Added 2026-09-11. Not part of the specification.*

## The earlier extract, and a correction to ADR-0008's standing

An extract was pasted into the project on 2026-09-11 labelled "§7–9" and
containing Garden Versions, Beds and the Plant Model. Against this document
those are **§10, §13–14 and §15–19** — the extract was renumbered.

On the strength of that extract, a note in this repo asserted that ADR-0008
had mis-cited its sources. **That assertion was wrong and is withdrawn.**
Checked against the real document, ADR-0008's citations are exact:

- **§7 Maps** — a Property MAY have multiple Maps; a Map is not the garden.
- **§8 Map Calibration** — "Calibration and display transformation are separate
  concepts."
- **§9 Property Map Database Model** — the `property_maps` table.
- **"§7.3, invariant 6"** — §7.3 *Map editing* states "Map transformations MUST
  be non-destructive"; invariant **6** in §39 repeats it. A compound citation,
  and both halves check out.

ADR-0008 is sourced accurately. The extract is the unreliable document.

**The extract also contradicts this one on a load-bearing rule.** Its §8.6 said
"A Plant Placement does not contain a `bed_id`" and that membership is derived
by point-in-polygon. This document's **§18** says the opposite: `bed_id` is an
explicit, nullable assignment, and geometric containment is
"validation/recommendation, not a competing source of truth" (invariants 13 and
14). Treat the extract as superseded; where the two disagree, this file wins.

## Conflicts with accepted ADRs

**ADR-0009 vs §18 + invariants 13–14 — narrower than first recorded.** An
earlier version of this note claimed §18 requires the gardener to pick a Bed by
hand. **It does not, and that reading is withdrawn.** The document contains no
picker, no dropdown and no manual assignment step anywhere; §28's click-to-place
workflow runs coordinates → snap → create Placement → select → Inspector, with no
Bed choice in it. "Explicit" in invariant 13 means *stored in a column* rather
than *recomputed*, not *chosen by a human*. The document never states where
`bed_id` gets its initial value, and placement position is the only candidate it
offers.

The real conflict is two narrow things:

1. **Sticky versus live.** §18.1 says that when a Bed is reshaped so a Plant
   falls outside it, the app must not rewrite `bed_id` and must warn instead —
   membership sticks to what it was at placement. ADR-0009 recomputes membership
   from geometry every time and explicitly accepts the consequence: "redrawing a
   Bed silently changes what is inside it... because nothing was ever assigned
   to lose."
2. **One Bed or many.** A single `bed_id` column holds one Bed. ADR-0009 and
   `CONTEXT.md` require a Pin inside two overlapping Beds to be associated with
   **both**. This document never contemplates overlapping Beds at all — §17.1's
   overlap rule is about plant *footprints*, and no section addresses Bed
   geometry overlapping. This is a gap in the specification rather than a
   considered disagreement: its model cannot represent the case.

A third point is unresolved inside the document itself. With no picker and a ban
on auto-rewriting, a stale assignment has no repair path short of moving the
plant. By §3's own taxonomy that is a **Specification Ambiguity**.

ADR-0009 stands. #54 implements it and inherits the deviation on point 1.

**ADR-0008's aerial-flatten vs §7.3 + invariant 6.** Already known and
documented in the ADR as a deliberate deviation under the specification's own
"Existing Implementation Superior" category (§3). Nothing new — but note the
original source image rule is a MUST, and invariant 6 is listed as authoritative.

**#41's "Beds are glued to the map" vs invariant 7.** Invariant 7: "Changing Map
position, rotation, crop, or display scale does not move garden objects." The
user's decision on 2026-09-11 was that rotating the aerial Map *does* move Beds
with it. Direct conflict with an authoritative invariant, taken knowingly.

**#41's canvas-up-is-not-north vs §5.3.** §5.3 fixes the Property coordinate
system as origin at the southwest corner, X→East, Y→North. #41 establishes that
canvas axes have no fixed relationship to north and that a bearing must be read
from stored `canvasNorthBearingDegrees`. These are reconcilable — a bearing plus
a rotation is a coordinate system — but nothing currently does that conversion.

**The measurement grid vs §23–25.** `CONTEXT.md`: the grid "is a reference, never
a drawing surface: nothing is snapped to it, no Bed or Pin is constrained by it."
§25 requires Snap, operating in world coordinates, at 1-inch increments, with
grid spacing and snap increment independent (§24).

## In the specification, absent from the app

Garden Versions (§10–11, §36); persistent Bed identity with version-specific
geometry (§13–14); the Plant Catalog / Owned Plant / Plant Placement split (§15,
rejected by ADR-0009); Property width/depth in integer inches with a fixed
origin (§5.2–5.3); 1-inch precision (invariant 23); Snap (§25); Inspector (§29);
undo/redo (§30); debounced autosave (§31); click-to-place as the *primary*
placement interaction (§28 — the app's Pin is drag-to-position).

## In the app, absent from the specification

The specification never mentions Tag Scan, OCR, bloom windows, the Bloom
Timeline, the Registry and its filters, reference or dated photo logs, hardiness
zones, native status, or the two-surface web/iPhone split. §15.1 mentions USDA
only as "MAY be supported architecturally for future use, but it is not a V1
requirement" — against ADR-0004, ADR-0006, ADR-0007 and a locally-held 48,994-name
checklist.

**These are two different products.** This document describes a Figma-style
garden *design* editor: versions, snap, undo, an inspector, mature-footprint
visualization. The app is a plant *registry*: what is planted, what it looks
like, when it blooms. They overlap on Property, Map and Bed and diverge almost
everywhere else. Adopting this document wholesale is not a reconciliation, it is
a change of product — which is a decision for the user, not an implementation
detail.
