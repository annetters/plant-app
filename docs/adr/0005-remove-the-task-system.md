# ADR-0005: The task system is removed from the app, not retained

## Status

Accepted — 2026-09-08. **Reverses the retention rule set on 2026-09-03**,
which removed the task system from the MVP commitment while deliberately
keeping it built, migrated, live and untouched. That rule is no longer in
force anywhere: this ADR supersedes it in `CONTEXT.md`, in the spec (#1) and
in `plant-app-handoff.md`.

## Context

On 2026-09-03 the task system — Care task templates, Task triggers, Task
completions and One-off todos — left the MVP commitment. Scheduling garden
care mattered less than the rest of the registry, and holding the MVP for its
remaining polish wasn't worth it. The feature was nonetheless *working*: built
by #4, #12 and #18, tested, migrated, and shipped on both web and iPhone.

So the decision was scope-only, and the code was kept. Three documents said so
explicitly — `CONTEXT.md` ("Nothing is deleted and nothing is hidden"), the
spec's Out of Scope ("Nothing was deleted or hidden") and Further Notes ("do
not delete them, and do not treat them as unfinished MVP work"), plus the
handoff doc's own scope-change entry ("No code was removed, and none should
be"). #21, the one piece never built, stayed open under a new `post-mvp`
label.

Five days later that retention rule was reconsidered. The feature is not
merely outside the MVP — **the gardener is no longer interested in it and
does not want to spend time or energy supporting it.** Retention was not free:
3,369 lines across 32 files and 67 tests ran in every CI pass, three modules
sat in `@plant-app/domain`'s export list, and the whole thing was standing
context every session and every review had to carry and route around.

The request that opened this was to *hide* the feature until a future time.
Working it through established that hiding was not what was actually wanted:
the database tables were to be dropped too, and once they are gone, retained
application code is not dormant, it is broken — `TasksPage` would query a
table that does not exist. There is no coherent middle state. The choice was
between keeping the feature live and removing it.

## Decision

**The task system is removed from the application entirely — code and
database.**

- **Deleted (32 files, 3,369 lines, 67 tests):** `apps/web/src/tasks/`,
  `TasksPage`, `PlantingTaskHistoryPage`, `apps/mobile/src/tasks/`,
  `TasksScreen`, `PlantingTaskHistoryScreen`, their test fixtures and fakes,
  and `packages/domain/src/{careTaskTemplate,taskCompletion,oneOffTodo}.ts`.
- **Stripped from 17 surviving files:** both dashboards' entry links, web's
  routes and repository providers, mobile's navigator and route params,
  `PlantFormPage`'s Care task templates section, both `plantsRepository`
  implementations, and `@plant-app/domain`'s export list.
- **Dropped in `0024_drop_task_system.sql`:** `task_completions`,
  `care_task_templates`, `one_off_todos`.

**All four terms leave `CONTEXT.md` as separate glossary entries**, collapsed
into one paragraph recording that they existed, were built, and were removed —
following Landmark's precedent that the glossary keeps deferred vocabulary,
but compressed, because five entries describing a feature the app cannot
perform is a museum rather than a glossary.

**The pure-domain modules were deleted too, not kept.** They have no database
dependency and would have kept compiling — `computeTriggerDateRange`,
`dateRangeWraps` and `buildPlantingTaskHistory` are the hardest-won logic
here. They still go, because keeping them spends exactly the energy this
decision exists to stop spending: 31 tests in every run, and a domain package
describing concepts the app has no way to act on.

**The rows were not exported.** Offered and declined: every account on this
project belongs to the same person, and they judged the data not worth
keeping. This is the one irreversible part of the change.

## Consequences

### Gains

- The retention cost is gone: no task tests, no task modules, no task schema,
  and no standing "do not delete this" rule for every future session to carry.
- `CONTEXT.md` describes only what the app can actually do.
- One commit contains the whole change, so `git revert` restores the
  application in a single step.

### Costs and risks

- **The rows are gone for good.** Code and schema are recoverable; the
  gardener's care task templates, completions and to-dos are not.
- **Restoring the feature is a revert plus a re-migration**, not a flag flip.
  The reverted `0024` would need a new forward migration recreating the three
  tables, since migrations here are forward-only.
- **#4, #12, #18 and #22 remain closed and accurate** — they record work that
  was genuinely done. A future reader finding them, and finding migrations
  `0003`/`0019`/`0021` creating tables that `0024` drops, should read this ADR
  rather than concluding something was lost by accident or left unfinished.
- **#21 (single-day trigger UX) is closed as `wontfix`** — it asked for an
  affordance on a form that no longer exists.

## Relationship to prior ADRs

Reverses no ADR — the 2026-09-03 scope change was recorded in `CONTEXT.md`,
the spec and the handoff doc, never as an ADR, which is part of why it was so
easy to state in three places and so easy to contradict. Touches ADR-0004 only
in passing: its "shared client package" list names task-template cascading as
an example of client-side domain logic. That example is now historical; the
placement rule it illustrates is unaffected.
