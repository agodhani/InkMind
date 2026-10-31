# InkMind — Vision

> Working name. A tablet-first app where you **learn by hand**: you sketch and
> write notes the way you already do, the app digitizes them live into clean,
> structured text (keeping your diagrams), and everything you write feeds a
> personal knowledge base that maps what you know — so the app can tell you
> what to learn next, hand you the right video or paper, and give you a
> project that proves you learned it.

This document is the *intent* of the project. It is deliberately ahead of the
code. See `docs/ROADMAP.md`-style phase notes at the bottom for what is built.

---

## 1. Why

Two things are true at the same time:

1. **Handwriting is how understanding actually happens.** Sketching the data
   flow of a training loop, drawing arrows between a reward model and a policy,
   scribbling `*` and defining it at the bottom of the page — that is thinking.
   No typed-notes app replaces it.
2. **Handwritten notes die on the page.** They are not searchable, not
   linkable, and existing OCR falls apart on messy handwriting. Worse, it
   flattens the *structure*: a footnote marker and its definition at the bottom
   lose their relationship; a diagram becomes garbage characters.

And separately: when you are self-teaching (e.g. "I know backprop and minimax,
I want to understand RLHF/RLVR"), the hardest part is not the material — it's
**logistics**: what to watch next, what is worth your time, what project
actually exercises the idea. LearnHarness (https://github.com/amosblomqvist/learnharness)
nails the *teaching* side of this: measure current understanding → plan a
dependency path → teach one step at a time → practice. We want that same
"the system absorbs the logistics" philosophy, but with **your own handwritten
notes as the primary input** and **real-world resources + projects** as the
primary output, rather than a chat tutor.

> Note: LearnHarness is AGPL-3.0. We borrow its *ideas* (knowledge graph of
> propositions, probe → plan → teach → practice, notes-as-a-front-door). We do
> not copy its code.

## 2. The product in one picture

```
            ┌─────────────────────────────────────────────────────┐
  pen ───►  │  INK PAGE  (strokes, live)                          │
            │     │ idle ~1s → dirty region → vision transcriber   │
            │     ▼                                                │
            │  DIGITAL PAGE (structured blocks: headings, lists,   │
            │  paragraphs, footnotes resolved, math, DIAGRAM crops)│
            │     ▲  toggle Ink / Digital / Split; tap block ↔ ink │
            └─────┼───────────────────────────────────────────────┘
                  │ corrections ──► Handwriting Profile (learns *you*)
                  │ blocks ───────► Markdown export (Obsidian-compatible)
                  ▼
            ┌─────────────────────────────────────────────────────┐
            │  KNOWLEDGE BASE  (concept graph built from notes)    │
            │   • what you've encountered / what you understand    │
            │   • what connects to what                            │
            └─────┬───────────────────────────────────────────────┘
                  ▼
            ┌─────────────────────────────────────────────────────┐
            │  LEARNING PATH  (goal + known → next steps)          │
            │   • curated resources (videos, papers, courses)      │
            │   • assignments: template repos you fill in          │
            │   • tracker: progress, schedule, review              │
            └─────────────────────────────────────────────────────┘
```

## 3. Part 1 — Live digitization of handwritten notes

### 3.1 Goals

- **Live.** Transcription happens as you write, not on "export". Stop writing
  for ~a second and the digital page catches up.
- **Two views of one page.** Ink view (exactly what you drew) and Digital view
  (clean text + diagrams). Toggle or side-by-side. Tap a digital block → its
  source strokes highlight; tap ink → the block it produced highlights.
- **Structure survives.** Headings, bullets, numbered steps, checkboxes,
  indentation, arrows between things, `*` / `†` / `(1)` markers and their
  definitions wherever they are on the page, margin notes, inline math.
- **Diagrams survive.** A sketch is kept *as a sketch* (the original ink,
  cropped) inside the digital page, with an LLM-written caption/description
  so it is searchable and usable by the knowledge base. We never try to turn a
  diagram into text; we keep it and describe it.
- **Messy handwriting is the normal case**, not the failure case.
- **The app learns how *you* write** and gets better the more you use it.

### 3.2 Why a vision LLM, not a classical handwriting API

The previous attempt (ObsidianInk) sent stroke coordinates to a dedicated
handwriting-recognition API and got back tokens per line. That approach:

- has no concept of page layout (footnote at bottom ≠ "next line"),
- cannot use context ("this page is about RLHF, so `PPO` not `PP0`"),
- cannot be personalized without retraining,
- returns nothing useful for diagrams.

Multimodal LLMs (Gemini 2.5 Flash/Pro, GPT-4o-class, Claude) read messy
handwriting *in context*, understand layout, and can be told who the writer
is. So the transcriber is: **render the ink to an image → send image + stroke
metadata + the writer's handwriting profile + page context → get back
structured blocks as JSON.** Stroke metadata (writing order, line clustering,
bounding boxes) is sent as text alongside the image; it resolves ambiguities an
image alone cannot (e.g. which marks were written together).

Trade-offs we accept: latency ~1–3 s per region (fine for "idle ~1s" live
updates), per-call cost (small images, only dirty regions), and a network
dependency (local models via Ollama/LM Studio with a vision model are a
supported fallback later).

### 3.3 Pipeline

1. **Capture.** Pointer events → `StrokeBuilder` → `Stroke` (points with
   time/pressure/tilt + brush). Pages are infinite canvases with pan/zoom.
   Undo/redo, eraser (stroke-level) — ported from ObsidianInk's ink core.
2. **Dirty regions.** On pen idle (debounce, ~1.2 s) take the strokes changed
   since the last run, cluster them spatially/temporally
   (`StrokeClustering`), and expand each cluster to the existing blocks it
   overlaps. That union is the *region* we re-transcribe. Everything else is
   untouched, so the digital page is stable while you write.
3. **Transcribe.** For each region: render strokes to PNG (white bg, 2× for
   legibility, capped edge), build the prompt (§3.4), call the vision model,
   parse JSON → `DigitalBlock[]`. Each block carries a bounding box in page
   coordinates and the ids of the strokes it was produced from.
4. **Merge.** Replace blocks inside the region with the new ones; keep
   everything else; keep block ids stable when text is unchanged (so edits and
   links do not jump). Order blocks top-to-bottom, left-to-right, with
   footnote-definition blocks attached to their reference.
5. **Render.** Digital view renders blocks: text as Markdown-ish rich text,
   `diagram` blocks as the original ink cropped (vector, so it stays crisp on
   zoom) with caption, `math` blocks as LaTeX.
6. **Correct.** Editing a digital block's text records a *correction*:
   `(ink crop, model output, user's fix)`. Corrections are the training signal
   for the handwriting profile (§3.5).
7. **Export / sync.** Page → Markdown (+ PNG/SVG for diagrams) in an
   Obsidian-compatible folder; blocks → knowledge base (Part 2).

### 3.4 The transcription prompt (shape, not final wording)

- System: "You are transcribing a page of handwritten study notes. Output
  JSON matching this schema…" Schema: blocks with `kind`
  (`heading|paragraph|list|checklist|footnote_ref|footnote_def|math|diagram|
  table|margin_note|unknown`), `text` (Markdown), `bbox`, `strokeIds`,
  `confidence`, `children` for nesting, `marker` for footnotes, `caption` for
  diagrams.
- Writer profile: glossary (terms this writer uses: *RLHF, PPO, minimax…*),
  habits ("writes footnotes with `*` and defines them at page bottom",
  "crosses 7s", "uses → for 'leads to'"), and a few **few-shot pairs**: crop
  image + verified transcription from past corrections.
- Page context: title, previously transcribed text of neighboring blocks,
  current learning topic (from Part 2).
- Stroke metadata: ordered list of line clusters with bboxes and stroke
  counts so the model can anchor `strokeIds`.

### 3.5 Learning the writer's handwriting

Three tiers, cheapest first; each strictly improves on the previous:

| Tier | Mechanism | When |
|------|-----------|------|
| **A. Prompt-time profile** | Corrections become few-shot examples (image crop + correct text) and a glossary; habits are summarized by an LLM from the corrections log. Injected into every transcription call. | Phase 1 (this is what we build first). |
| **B. Retrieval** | Thousands of corrections won't fit a prompt. Embed the ink crops (or their stroke-shape features) and retrieve the k nearest past samples for each new region. Also retrieve vocabulary from the knowledge base. | Phase 2 |
| **C. Fine-tuning** | Export the corrections dataset `(image, text)` and fine-tune a small open handwriting model (TrOCR / Florence-2 / PaliGemma-class) *per user*, or LoRA a small VLM. Use it as a first pass; the big model arbitrates only low-confidence regions. Also enables an offline mode. | Phase 3, once there are >~2k verified samples. |

The important design choice is that **every correction is captured from
day one** in a format that serves all three tiers. The dataset *is* the moat.

### 3.6 Non-goals for Part 1

- Real-time per-stroke recognition (we are "idle-triggered", not keystroke).
- Converting diagrams to vector/Mermaid automatically (describe, don't convert;
  optional later).
- Multi-user / collaboration.

## 4. Part 2 — Knowledge base and curated learning path

### 4.1 Knowledge base

Every transcribed block is a candidate source for a **concept graph**:

- **Nodes are concepts/propositions** you have encountered ("PPO clips the
  policy ratio to limit update size"), with provenance back to the exact
  block/page/date. We follow LearnHarness's stance: the graph stores *what is
  true about the domain*, and your understanding is **inferred** from your
  notes, your corrections, and your assignment results — never stored as a
  "skill level" number.
- **Edges** are `follows` (B is derivable from A) and `supports` (A grounds
  B). Prerequisite strength is derived from topology at read time.
- Extraction is post-hoc and batched (an LLM reads newly transcribed text and
  proposes propositions + chains; a merge step dedupes against the existing
  graph). Diagrams contribute via their captions.
- Obsidian-style `[[links]]` in your handwriting become explicit edges; the
  app also *suggests* links when a block mentions an existing concept.

### 4.2 Learning path planner

Input: a **goal** ("understand RLHF and RLVR well enough to implement a toy
version"), the **graph** (what you've already written about = what you
already know), and your **preferences** (video vs. paper, hours/week).

Output: a **dependency map** from where you are to the goal — the minimal
tree — rendered as a path you can see and edit. Each step has:

- **Resources**, curated and ranked: YouTube (e.g. Karpathy's *Zero to
  Hero*), papers, docs, courses. Ranking = "highest expected value *for your
  notes*": covers the most un-held prerequisites, matches your format
  preference, respected sources.
- **Assignments**: a concrete project that exercises the step. Where
  possible, a **template repo** (starter code with the core left blank, tests
  included) that you can open and code directly in. Finishing an assignment is
  evidence that the step's propositions are held.
- **Checks**: a few questions in the LearnHarness "think out loud" style —
  optionally answered *by handwriting* on an ink page.

### 4.3 Tracker and schedule

- Progress per step (not started / resources consumed / assignment done /
  reviewed).
- A **schedule builder**: given hours/week and a target date, lay the path on a
  calendar; re-plan when you fall behind or skip ahead.
- **Review**: spaced resurfacing of propositions whose only evidence is old.
- **"What next?"** is always one tap away and always explained ("because you
  wrote about value functions on Tue but nothing yet about advantage
  estimation, which RLHF's PPO step needs").

### 4.4 The loop that makes it one app

Notes → graph → path → resources → **more notes** (you sketch while watching
the video or doing the assignment) → graph → …. Part 1 makes handwriting a
first-class input; Part 2 makes it count for something.

## 5. Architecture (target)

- **Client:** React + TypeScript + Vite PWA, tablet-first (pointer events,
  pressure/tilt, palm rejection via `pointerType === 'pen'` preference).
  Local-first: pages, blocks, corrections in IndexedDB; works offline for ink,
  queues transcription until online.
- **Model access:** a thin `Transcriber` interface. First implementation:
  OpenRouter (Gemini 2.5 Flash default, Pro for low-confidence re-runs). Later:
  direct Gemini/OpenAI/Anthropic, Ollama/LM Studio local VLM, fine-tuned model
  (§3.5 C).
- **Sync/server (Part 2):** small Node API + Postgres/pgvector for graph,
  embeddings, resource catalog, assignments. Reuse ObsidianInk's server shape
  where it helps; nothing depends on it in Part 1.
- **Export:** Markdown + assets folder, Obsidian-compatible, with front-matter
  linking back to page ids.

## 6. Phases

| Phase | Scope | Done when |
|-------|-------|-----------|
| **1 — Ink + live digitize** | New repo, ported ink core (canvas, strokes, pan/zoom, eraser, undo), idle-triggered region transcription via vision LLM, Ink/Digital/Split views, tap-to-link, diagram blocks as ink crops, correction capture → prompt-time handwriting profile, local persistence, Markdown export. | You can write a messy page with a diagram and a `*` footnote and get a faithful, structured digital page within seconds; fixing a word once makes the same word come out right next time. |
| **2 — Knowledge base** | Proposition/edge extraction from blocks, graph view, `[[links]]`, link suggestions, retrieval-based handwriting profile. | Your pages build a browsable concept map with provenance. |
| **3 — Learning path** | Goal entry, path planner over the graph, resource catalog + ranking, assignments with template repos, tracker + schedule, handwritten checks. | "I know backprop and minimax, I want RLHF/RLVR" yields a path with ranked videos and a starter project, and the tracker updates as you take notes. |
| **4 — Personal model** | Export corrections dataset, per-user fine-tune, local/offline first pass. | Fine-tuned model beats the generic one on your held-out pages. |

## 7. Open questions

- Page model: fixed "sheets" (closer to paper, easy to export) vs. one infinite
  canvas per note (ObsidianInk's model)? Leaning: infinite canvas with
  soft page breaks for export.
- Where does the first version of the resource catalog come from — hand-curated
  seed list + LLM web research, or purely LLM at plan time?
- Assignments: generate template repos per user with an LLM, or maintain a
  curated set per topic? Probably both, curated first.
- Privacy: ink images leave the device for transcription. Local VLM fallback
  is the answer, but it is Phase 4 quality.
