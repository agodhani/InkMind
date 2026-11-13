/**
 * Local-model smoke test for the figure geometry: renders the synthetic complex scenes
 * (flowchart with a back-edge, state machine, nested boxes, sequence diagram, table, mind map,
 * arrows between words, two figures on a page) exactly like the app does, sends them to an Ollama
 * vision model with the geometry hints, runs the figure reconciler and writes what came back.
 *
 *   npx tsx scripts/figureSmoke.ts --model qwen2.5vl:3b [--out .tmp/smoke] [--scene flowchart-loop]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { Agent, setGlobalDispatcher } from 'undici';
import { ALL_SCENES } from '../src/__tests__/complexScenes';
import { resetSynthetic } from '../src/__tests__/shapes';
import { unionBounds } from '../src/model/page';
import { figureCaption } from '../src/transcribe/figure';
import { OllamaTranscriber } from '../src/transcribe/ollama';
import { buildStrokeGroups, rawToDigitalBlock, reconcileFigureBlocks } from '../src/transcribe/regions';
import { MODEL_RENDER, renderStrokesToPng, type CanvasFactory } from '../src/transcribe/render';
import type { TranscribeRequest } from '../src/transcribe/types';
import { figureLines } from '../src/export/markdown';

setGlobalDispatcher(new Agent({ headersTimeout: 0, bodyTimeout: 0 }));
const nodeCanvas: CanvasFactory = (w, h) => createCanvas(w, h) as unknown as ReturnType<CanvasFactory>;

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1] ?? 'true'] : [])).filter((p) => p.length));
const model = args.model ?? 'qwen2.5vl:3b';
const outDir = join(args.out ?? '.tmp/smoke', model.replace(/[^a-z0-9.]+/gi, '_'));
mkdirSync(outDir, { recursive: true });
const transcriber = new OllamaTranscriber({ url: args.url, model });

const report: string[] = [`# Figure smoke: ${model}`, ''];
for (const make of ALL_SCENES) {
  resetSynthetic();
  const scene = make();
  if (args.scene && args.scene !== scene.name) continue;
  const groups = buildStrokeGroups(scene.strokes);
  const bounds = groups.map((g) => g.bbox).reduce(unionBounds);
  const rendered = renderStrokesToPng(scene.strokes, bounds, { createCanvas: nodeCanvas, ...MODEL_RENDER })!;
  writeFileSync(join(outDir, `${scene.name}.png`), Buffer.from(rendered.dataUrl.split(',')[1], 'base64'));
  const req: TranscribeRequest = {
    imageDataUrl: rendered.dataUrl,
    imageBounds: rendered.bounds,
    imageSize: rendered.size,
    strokes: scene.strokes,
    groups,
    contextText: '',
    pageTitle: scene.name,
    profile: { glossary: [], habits: [], examples: [] },
  };
  const expected = Object.keys(scene.labels);
  const t0 = Date.now();
  let lines: string[] = [];
  try {
    const r = await transcriber.transcribe(req);
    writeFileSync(join(outDir, `${scene.name}.raw.txt`), r.raw ?? '');
    const mapped = r.blocks.map((b) => rawToDigitalBlock(b, groups, rendered.bounds, rendered.size, scene.strokes));
    const blocks = reconcileFigureBlocks(mapped, groups, scene.strokes);
    writeFileSync(join(outDir, `${scene.name}.blocks.json`), JSON.stringify({ raw: mapped, reconciled: blocks }, null, 2));
    for (const b of blocks) {
      lines.push(`- **${b.kind}** ${JSON.stringify(b.text)}${b.figure ? ` · figure.kind=${b.figure.kind}` : ''}`);
      if (b.figure) {
        lines.push(`  - geometry caption: ${figureCaption(b.figure)}`);
        lines.push(...figureLines(b).filter(Boolean).map((l) => `  ${l}`));
      }
    }
    const diagrams = blocks.filter((b) => b.kind === 'diagram');
    const got = new Set(diagrams.flatMap((b) => b.figure?.labels ?? []).map((l) => l.toLowerCase()));
    const found = expected.filter((e) => got.has(e.toLowerCase()));
    lines.unshift(`diagram blocks: ${diagrams.length} · labels read ${found.length}/${expected.length} (${expected.map((e) => (got.has(e.toLowerCase()) ? e : `~~${e}~~`)).join(', ')}) · model edges: ${diagrams.flatMap((b) => b.figure?.edges.filter((e) => !e.inferred) ?? []).length}, inferred from ink: ${diagrams.flatMap((b) => b.figure?.edges.filter((e) => e.inferred) ?? []).length} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  } catch (err) {
    lines = [`ERROR: ${(err as Error).message}`];
  }
  const hints = groups.filter((g) => g.figure).map((g) => g.figure!.summary).filter((s, i, a) => a.indexOf(s) === i);
  report.push(`## ${scene.name}`, '', `Geometry: ${hints.join(' | ')}`, '', ...lines, '');
  console.log(`[${model}] ${scene.name}: ${lines[0]}`);
  writeFileSync(join(outDir, 'REPORT.md'), report.join('\n'));
}
