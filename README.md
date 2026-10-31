# InkMind

Learn by hand. A tablet-first notes app that digitizes your handwriting **live**
into structured text (keeping your diagrams as diagrams), learns how *you*
write, and — later — turns your notes into a knowledge map and a curated
learning path.

Read [`docs/VISION.md`](docs/VISION.md) for where this is going. This README
covers what exists today (Phase 1: ink + live digitization).

## What works

- **Ink page**: pen/eraser/pan, pressure, pinch-zoom, finger-pans-while-pen-draws,
  undo/redo (`Ctrl+Z` / `Ctrl+Shift+Z`), infinite canvas, pages stored locally
  (IndexedDB).
- **Live digitization**: stop writing for ~1.2 s and only the region you changed
  is sent to a vision LLM (OpenRouter → Gemini 2.5 Flash by default). It comes
  back as structured blocks: headings, lists, checklists, math, footnote
  references **and their definitions** (wherever they are on the page), margin
  notes, and **diagrams** — which stay as crops of your original ink with a
  caption.
- **Ink ↔ Digital**: Ink / Split / Digital views. Tap a digital block and its
  source strokes light up; tap ink and its block is selected.
- **Corrections → handwriting profile**: double-tap a block to fix it. The ink
  crop + your text is saved; recent fixes are sent as few-shot examples with
  every transcription and the words the model missed become glossary hints.
  Add your own habits/glossary in Settings. Export the dataset as JSON.
- **Export**: Obsidian-compatible Markdown (footnotes, diagram embeds).

Without an API key the app runs a **mock transcriber** so the whole flow is
usable offline (placeholder text).

## Run

```bash
npm install
npm run dev        # http://localhost:5173, also exposed on your LAN for a tablet
npm test           # vitest, no network
npm run lint
npm run build
```

Add an OpenRouter key in **⚙ Settings** (stored in the browser only), or put
`VITE_OPENROUTER_API_KEY=...` in `.env` for local dev (see `.env.example`).

## Layout

```
src/
  ink/         canvas, stroke capture, rendering, pan/zoom, clustering (ported from ObsidianInk)
  model/       Page / InkStroke / DigitalBlock types
  transcribe/  Transcriber interface, OpenRouter + mock implementations, prompt,
               dirty-region computation, block merging, useTranscription hook
  profile/     corrections store → handwriting profile
  views/       DigitalView (block rendering + inline correction)
  export/      Markdown export
  store/       IndexedDB
docs/VISION.md the plan
```
