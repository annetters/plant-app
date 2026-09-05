# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.

## Scope labels

Separate from the five triage roles above. A triage role says **how ready** an
issue is; a scope label says **whether it's in the MVP commitment at all**. The
two are orthogonal, so an issue can carry one of each — `#23` is
`ready-for-agent` *and* `post-mvp`: fully specified, and not blocking the MVP.

| Label      | Meaning                                                        |
| ---------- | -------------------------------------------------------------- |
| `post-mvp` | Real work, outside the MVP commitment; may be revisited later    |

Deliberately **not** in the table above, because `/triage` doesn't know about
it and must never apply it as a triage outcome.

### `post-mvp` vs `wontfix`

- **`post-mvp`** — we'd do this, just not before shipping. Deferred, not
  rejected.
- **`wontfix`** — decided against on the merits. Reach for it when a decision
  already recorded in `CONTEXT.md` or an ADR settles the question, and say
  which one in a comment.

Anything on a path the spec calls optional (Tag Scan OCR quality, per story 15
in #1) is `post-mvp` by default, not MVP work.
