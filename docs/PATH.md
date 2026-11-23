# Learning paths

This is an offline, deterministic planner, not a model or a numeric understanding score.

## Subject maps

`src/path/maps/ml.json` is the curated ML map. A map has `id`, `subject`, `version`,
`provenance` (`status: verified | unverified`, `source`, optional `model`), optional
ordered `areas: [{id,label}]`, and `concepts`. Each concept has `id`, `label`,
`aliases`, `description`, `prerequisites` (ids), and an `area` when areas exist.
Verified means curated; model-generated or otherwise unchecked maps must be marked
unverified. The learning path and What next panel mark unverified plans.

`validateMap` rejects duplicate ids, shared normalized terms, missing descriptions
or labels, unknown/self prerequisites, cycles, unknown areas, and prerequisites
in later areas. A valid map is required before planning or evaluation.

## Matching

`matchNotes` resolves labels and aliases with KB `termKey`. Deterministic graph
concepts and accepted model concepts count as known, with note provenance.
Unaccepted model concepts and pending concept/alias proposals count at most as
partial. Pending aliases cannot promote their target to known.
Text mentions use `scanTerms` over every map form, longest first. A mention is
partial only when the page has another distinct map concept hit; isolated generic
words are ignored. Declarations resolve strictly, mark concepts known, and are
kept separate from evidence. Note evidence takes precedence over declarations.

## Planning

`planPath` resolves goals by id or normalized label/alias. Knowing a concept implies
its transitive prerequisites, with an explicit assumed reason. Traversal from goals
stops at known/assumed nodes, not partial nodes. Steps are filtered from one Kahn
topological order of the whole map, with ties broken by area rank then file index.
Consecutive steps are grouped by area, or canonical-order bands without areas.
Each step explains what needs it and what the notes show; `next` lists ready steps.
Replanning retains previous steps in position, marks newly covered steps done, and
preserves the remaining order.

## Learning path UI

Path anchors to the full prerequisite set for the selected goals, so
already-covered relevant steps are visible and positions stay stable as the
KB changes. The dependency picture focuses on one concept at a time, with
direct prerequisites and what they unlock. The picker covers the whole
path without a large canvas or tiny controls.

A map-scoped local TrackerStore saves goals, declarations, skips and the
last acknowledged note-evidence checkpoint. Live step states are derived
from the KB. Skipping suppresses a recommendation but never satisfies a
prerequisite. An empty page started from What next is titled for the
concept but is not evidence by itself; write the title as a heading in
the notes to connect them.

Resource and project rendering accepts an optional `PathMaterialsProvider`
with `forStep(mapId, conceptId)` and `forStage(mapId, stageId)`. Both return an
optional bundle of resource links and one project link. Until a catalog
is wired in, the two slots show an explicit empty state.

`createRankedMaterials(map, plan, catalog, projects, prefs)` in
`src/path/rankedMaterials.ts` builds an assignable provider without UI dependencies.
Step resources are the top three per-step recommendations; stage resources are
the first three path recommendations covering any remaining step in that stage,
in path-ranking order. Projects use the first ranked match (exercising the step
or attached to the stage). Done/unknown steps and other maps return no materials.
Its richer return type also exposes `reason`, `format`, `minutes` and `free`
on every link; projects are free code links. This adapter is not yet wired into
the UI.

In `?sim=1`, **Load RLHF + RLVR demo** adds deterministic copies of the
backpropagation and minimax notebooks, selects both goals and opens Path.
Existing demo copies aren't overwritten. The path does not call a model.

## Projects and evidence

Each `StarterProject` declares `id`, `title`, `mapId`, area-id `stage`,
exercised `concepts`, `minutes`, `level`, repo-relative `dir`, `files`,
`solutionFiles`, test `run` command and environment `requirements`.
`validateProjects` checks map concepts/stages, duplicate ids, nonempty exports,
safe relative paths and separation of learner files from solutions.
Starter manifests live at `<dir>/project.json`. Export only `files`; never export
`solutionFiles`. The toy alignment project provides a NumPy-only starter and
separate reference implementation; its README explains the exercises and tests.
Node-only `checkProjectFiles` in `projects.node.ts` checks both lists for eval use.
Passing a project supplies explicit project evidence for its concepts, not note
evidence or declarations. Basis precedence is notes > project > declared. Failed
results do not count. Project evidence is kept even when notes take precedence.
Project results must come from a trusted test runner, not an unchecked model claim.

## Resources and ranking

The catalog is `{mapId, version, resources}`. Each resource has a stable kebab-case
`id`, `title`, `author`, HTTPS `url`, `format` (video/paper/book/course/docs/code),
positive integer `minutes`, `level` (intro/intermediate/advanced), boolean `free`,
substantively taught map `concepts`, ISO-date `checked`, and optional `note`.
`validateCatalog` checks required fields, enums, real dates, map membership and
duplicate ids/URLs (host case, www, fragments and trailing slashes normalized).

No invented links: every catalog URL must be fetched in the curation session with
redirect following and a browser User-Agent, or checked in a browser if blocked.
Inspect expected content/title, not just HTTP status; drop unverifiable links.
Assign concepts conservatively. Sutton & Barto is omitted because incompleteideas.net
serves a self-signed certificate, preventing verification.

All 41 steps in the backprop/minimax → RLHF/RLVR case have a free resource.
Map concepts currently without resources: `linear-algebra`, `calculus`,
`partial-derivatives`, `sgd`, `optimizers`, `cnn`, `rnn`, `search`,
`game-trees`, `minimax`, `alpha-beta`, `expectimax`, `dqn`, `peft`.

The free-first ML catalog records URLs checked on the stated date. Run
`npm run links:check` separately from `npm run check` to refresh
`eval/resources/link-check.json`. Successful HTTP responses do not themselves
prove that a resource teaches a concept; concept assignments are curated.

`rankResources` is deterministic. Remaining steps have status other than done.
Step weight is 1 for todo, 0.5 for partial, plus 0.5 for a goal step.
Value is the sum of weights of covered remaining steps. Resources covering none
are excluded, as are non-free resources when `freeOnly` is true (the default).

- Format factor: 1.5 when the resource format is in preferred `formats`, else 1.
- Level factor: 0.75 for advanced resources if any covered step has a prerequisite
  that is a not-done plan step not covered by the resource ("assumes X first").
  For intro resources it is 0.75 if at least half of their concepts are
  known, assumed or done ("mostly reviews what you know"). Otherwise it is 1.
- Time factor: `1 / (1 + minutes / 240)`, multiplied by 0.5 when
  `maxMinutes` is set and the resource exceeds it.
- Score: `round(value * format * level * time, 4)`. Ties use higher value,
  fewer minutes, then id in ascending lexical order.

Path ranking greedily rescoring value only over steps not covered by earlier
picks stops at `limit` (default 10) or when nothing adds coverage. Other factors
stay fixed. Recommendation `covers` lists all covered remaining steps in plan
order; path reasons distinguish total coverage from newly added coverage.
Per-step lists include all eligible resources covering that step, scored on full
value, with reasons explaining other coverage, level and time.
Prerequisite warnings name at most three concepts followed by "and N more";
per-step reasons omit the additional-coverage clause when it would be zero.

`rankProjects` returns projects intersecting remaining steps, attached to their
manifest stage, ordered by covered-step count descending then id. Neither ranking
calls a model or treats recommendations as proof of knowledge.
