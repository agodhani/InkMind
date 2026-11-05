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
  is sent to a vision LLM (a local Ollama model, or OpenRouter). It comes
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

Transcriber providers (pick one in **⚙ Settings**):

| Provider | Cost | Notes |
|---|---|---|
| **Ollama (local)** | free, offline | `ollama pull qwen2.5vl:7b` (or `qwen2.5vl:3b`, `gemma3:4b`). Slow on CPU, fine on a GPU. |
| **OpenRouter** | free tier with a key | `:free` models such as `dots-studio/dots-3-note-preview:free`; paid Gemini/GPT/Claude also work. |
| **Mock** | — | placeholder text so the ink ↔ digital flow is usable with nothing installed. |

## Run

```bash
npm install
npm run dev        # http://localhost:5173, also exposed on your LAN for a tablet
npm test           # vitest, no network
npm run lint
npm run build
```

### Local model (Ollama)

```bash
curl -fsSL https://ollama.com/install.sh | sh   # or https://ollama.com/download
ollama pull qwen2.5vl:7b
```

Then Settings → Transcriber → **Ollama (local)**. The app talks to
`http://localhost:11434` straight from the browser; Ollama allows localhost
origins by default. Settings suggests a few known vision models plus any pulled
models whose `ollama show` lists the `vision` capability (models on older Ollama
versions that don't report capabilities are listed too).

To draw on a tablet while the model runs on your computer, Ollama has to accept
requests from the tablet's browser. Its API has no authentication, so keep the
exposure narrow: do this only on a network you trust, bind to your LAN address
rather than every interface, and allow just the app's origin:

```bash
OLLAMA_HOST=192.168.1.20 OLLAMA_ORIGINS="http://192.168.1.20:5173" ollama serve
```

(replace with your computer's LAN IP), then set the Ollama URL in Settings to
`http://192.168.1.20:11434`. Stop that server when you're done.

### OpenRouter

Add a key in **⚙ Settings** (stored in the browser only), or put
`VITE_OPENROUTER_API_KEY=...` in `.env` for local dev (see `.env.example`).

## Layout

```
src/
  ink/         canvas, stroke capture, rendering, pan/zoom, clustering (ported from ObsidianInk)
  model/       Page / InkStroke / DigitalBlock types
  transcribe/  Transcriber interface; OpenAI-compatible client used by Ollama + OpenRouter; mock; prompt,
               dirty-region computation, block merging, useTranscription hook
  profile/     corrections store → handwriting profile
  views/       DigitalView (block rendering + inline correction)
  export/      Markdown export
  store/       IndexedDB
docs/VISION.md the plan
```
