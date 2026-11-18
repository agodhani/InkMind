# Knowledge-base extraction

The KB is an offline, deterministic graph layer. It is not wired to the UI or App and makes no
model calls. `PageExtraction` is its JSON-serialisable interchange format; `Extractor` in
`src/kb/extractor.ts` separates raw extraction from parsing so future model extractors can replay
saved responses through the same merge and scoring paths.

## Sources and edges

- Headings define concepts, with nested headings connected by `contains`. Sections close at the
  next same-or-higher-level heading; missing levels default to 2.
- `[[target]]` and `[[target|alias]]` define the target and explicit aliases. A surrounding section
  gets a `mentions` edge to the target.
- Seen profile-glossary entries define concepts, including short parenthetical aliases. Matches
  use normalised whole-token sequences in text and diagram captions, never unseen glossary entries.
- Flowcharts and graphs define labelled nodes; arrows produce `follows`, lines produce directional
  `mentions`, nested boxes produce `contains`. Trees and mind maps produce `contains` hierarchy;
  mind-map non-tree edges retain arrow/line semantics. Venn sets contain their members, including
  shared members in each overlapping set.
- Sequences define steps with consecutive `follows` edges. Lifeline actors define concepts, not
  actor-to-actor edges. Tables define column-header concepts only; row labels are attributes,
  including when the top-left cell is empty.
- Plot/sketch/cube/shape structure produces nothing; caption links/glossary still apply.
- Known concepts and aliases can be mentioned in other text. Mentions never create concepts.

`follows` means the target follows from the source. `supports` means the source grounds the target
and is reserved for future model extraction. `mentions` is a weak association, kept directional.
`contains` was added because heading hierarchy, trees, mind maps, nested boxes and Venn membership
are explicit part/subtopic/member relationships, not inference or support. Self-edges are dropped.
There are no implicit heading-to-diagram-node edges.

Both scans exclude link contents and partial heading matches. Longest matches win without overlap.
Provenance names page/block/extractor/surface. Stroke IDs are included only where term ink is known,
such as headings or figure nodes/connectors, not arbitrary surrounding text.

## Normalisation and merging

Term keys use NFKC, lowercase, markdown/punctuation removal, possessive removal, separator folding
and conservative per-word singularisation with acronym and exception handling. Parenthetical aliases
of 1–4 words and link aliases explicitly connect keys. Only equal keys or explicit aliases merge:
near-misses such as policy/policy gradient, RLHF/RLVR and Q function/value function remain distinct.
Empty, numeric, one-character, generic shape/control labels, hint IDs and labels over eight words
are not concepts.

Graph construction sorts pages, clusters defining keys, selects the most frequent declared term
form (heading preference, then earliest page/block on ties), and unions provenance and edge labels.
Written surfaces stay in provenance; key-equal spelling/plural variants do not replace the declared
label. Written forms with different keys remain aliases.
Concept IDs reuse compatible previous IDs or use deterministic label-key slugs; edges are keyed by
source/kind/target. Output collections are sorted for deterministic, deep-equal re-syncs.

## Persistence and lifecycle

`syncPage` replaces that page's extraction, rebuilds from all retained extractions and commits the
extraction and graph atomically. `removePage` removes only that page's source evidence. Editing or
deleting the last defining occurrence deletes the concept even if mention-only text remains.
Other pages' definitions survive. Callers should serialize synchronization operations on a store.

`MemoryKnowledgeStore` isolates values with structured clones. `IndexedDbKnowledgeStore` uses one
readwrite transaction across `kbExtractions`, `kbConcepts` and `kbEdges`. IndexedDB v2 adds these
stores while preserving existing pages, corrections and settings.

See [the eval guide](../eval/README.md#knowledge-base-eval) for answer keys, replay and gate metrics.
