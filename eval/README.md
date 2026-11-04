# Transcription eval

Scores the app's real transcriber + prompt against human-written references.

```bash
# 1. extract ink from a tablet-app PDF (PDF Expert / GoodNotes export) → InkMind strokes
pip install pymupdf pillow
python3 scripts/pdf_to_strokes.py notes.pdf eval/<name>/strokes.json --png-dir eval/<name>/pages
pdftoppm -r 150 -png notes.pdf eval/<name>/pages/page      # raster of the original pages

# 2. write eval/<name>/reference.md with the true text, pages separated by `<!-- page N -->`

# 3. run (Ollama must be up; OpenRouter needs OPENROUTER_API_KEY)
npm run eval -- --dataset eval/<name> --provider ollama --model qwen2.5vl:7b             # whole page, PDF raster
npm run eval -- --dataset eval/<name> --provider ollama --model qwen2.5vl:7b --band 6    # 6 line-groups per request, rendered from strokes (how the app works)
npm run eval -- --dataset eval/<name> --provider openrouter --model google/gemma-4-31b-it:free
```

Results land in `eval/<name>/results/<run>/` — `summary.md` (WER/CER per page, committed) and
`page-N.json` with the blocks, hypothesis and reference (local only). The same `strokes.json`
can be loaded into the app via Pages → Import… to see and correct the transcription live.

WER/CER are computed on lower-cased text with punctuation, bullets, arrows and Markdown stripped,
so they measure *reading* accuracy, not formatting.
