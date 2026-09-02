## Agent skills

### Issue tracker

Issues live as GitHub issues in `annetters/plant-app`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (one `CONTEXT.md` + `docs/adr/` at the repo root). See `docs/agents/domain.md`.

## Working with the user

When the user asks to check in, confirm, or see a plan before work starts (e.g. "check with me first," "tell me the plan before starting"), stop and wait for an explicit go-ahead before making any changes — do not post the plan and continue into edits in the same turn. This holds even under an auto/no-questions mode; an explicit request to check first overrides the general bias toward proceeding without stopping.

### Manual QA ownership

Before starting a QA pass (e.g. after `/implement` or when a ticket's handoff notes list deferred QA items), ask the user whether they want to run it themselves or have it done via Playwright/automated browser driving. Don't assume and jump straight into scripting a Playwright pass — "start QA" is not by itself authorization to automate it. This applies even when prior sessions in this repo used a Playwright-driven pass for similar tickets; that history isn't standing authorization for the next one.

### Closing issues

**Never close a GitHub issue unless the user explicitly asks.** This applies to every issue in this repo, without exception — not just ones that have been singled out.

A ticket being finished is not authorization to close it. Implemented, code-reviewed, fully tested, manually QA'd, findings fixed and committed — none of that, alone or together, means closed. The user decides when an issue closes, and they may be holding it open for reasons that aren't visible in the code or the tracker: work they intend to come back to, a check they haven't run yet, or a judgement about whether the ticket actually delivered what they wanted.

Earlier sessions closed tickets as a matter of course once QA passed (#6, #9, #10, #11, #12, #16, #17, #20). **That precedent is superseded by this rule** — don't cite it as a reason to close something. If a ticket looks finished and closable, say so and ask; then leave it alone until you get an answer.

The same caution applies to anything that reads as closure by proxy: don't relabel a ticket to mark it done, and don't mark it resolved in the handoff doc as though it were closed. Recording "QA passed, awaiting the user's closure" is accurate and fine.
