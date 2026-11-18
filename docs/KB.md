# Knowledge-base extraction

The KB defaults to offline deterministic extraction. It is not wired to the UI or App. Callers
can opt into a text-only model with `syncPage(store, page, { glossary, extractor })` and
`modelExtractor(ollamaKbModel())`. `PageExtraction` is the JSON-serialisable interchange format;
`Extractor` separates raw extraction from parsing so saved responses can replay through the same
merge and scoring paths.

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
and is proposed only by model extraction. `mentions` is a weak association, kept directional.
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

## Model proposals

- The model sees new/changed nonempty block text (including captions and footnotes) and a bounded,
  relevance-ranked list of local deterministic and existing trusted labels. Unchanged blocks reuse
  previous proposals with the same provider/model; deleted or edited blocks lose old proposals.
  Requests contain no ink or images. Ollama runs locally by default; OpenRouter is opt-in and only
  accepts free routes.
- New concepts must be written in their cited block. Claims and explicit edges need exact source
  quotations; edges must cite both endpoints and resolve to graph nodes. Model provenance records
  page/block and the cited surface, not guessed stroke IDs.
- The model layer cannot join two deterministic concepts. It dedupes exact normalized terms,
  including case/plurals. A proposed alias can join a single trusted label via an initialism or
  a distinctive single-word truncation, but not by substring or topic similarity. Grounded claims
  can also supply evidence of a distinctive truncation when the claim uses the short or long form.
  Claims identified as restatements of a known concept attach to that node; other claims can form
  separate nodes. Model-derived section mentions are proposals too.
- `graph.proposals` is the review list. Each item has a stable normalized ID, `origin: 'model'`,
  `status: 'proposed' | 'accepted'`, provenance and a concept or edge ID. Model-only nodes and
  edges carry those fields as well. Existing deterministic nodes/edges keep their existing shape;
  proposed aliases or additional evidence on them have a separate review item. To display facts
  only, exclude proposed model-only items and their dependent edges, and distinguish contributed
  aliases/provenance using the review list and `model:` provenance prefix.
- `reviewProposal(store, id, 'accepted' | 'rejected')` updates the graph. Rejected IDs are
  tombstoned even if the source page is deleted; rebuilding never hides independent deterministic
  evidence. Review IDs intentionally do not fuzzy-match rewritten claims, which may differ in
  meaning. `store.clear()` resets both the graph and decisions.

## Persistence and lifecycle

`syncPage` replaces that page's extraction, rebuilds from all retained extractions and commits the
extraction and graph atomically. `removePage` removes only that page's source evidence. Editing or
deleting the last defining occurrence deletes the concept even if mention-only text remains.
Other pages' definitions survive. Callers should serialize synchronization operations on a store.

`MemoryKnowledgeStore` isolates values with structured clones. `IndexedDbKnowledgeStore` uses one
readwrite transaction across `kbExtractions`, `kbConcepts`, `kbEdges` and a KB-specific key in
`kv` for review metadata. No new IndexedDB schema version is needed.

See [the eval guide](../eval/README.md#knowledge-base-eval) for answer keys, replay and gate metrics.
