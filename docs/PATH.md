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

In `?sim=1`, **Load RLHF + RLVR demo** adds deterministic copies of the
backpropagation and minimax notebooks, selects both goals and opens Path.
Existing demo copies aren't overwritten. The path does not call a model.
