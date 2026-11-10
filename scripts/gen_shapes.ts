/**
 * Generate synthetic ink datasets (shapes, graphs, cubes, flowcharts, note pages) in the eval/<name>/
 * layout scripts/eval.ts reads: strokes.json + pages/page-N.png + reference.md (text + figure expectations).
 *
 *   npm run gen:shapes                       # all datasets in src/sim/scenes.ts DATASETS
 *   npm run gen:shapes -- --dataset graphs   # one dataset
 *   npm run gen:shapes -- --out /tmp/x       # write under another directory
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { DATASETS, buildScene, sceneReference } from '../src/sim/scenes';
import { RENDER_PAD, renderStrokesToPng, type CanvasFactory } from '../src/transcribe/render';

const nodeCanvas: CanvasFactory = (w, h) => createCanvas(w, h) as unknown as ReturnType<CanvasFactory>;

const args: Record<string, string> = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const outRoot = args.out ?? 'eval';
const only = args.dataset?.split(',');

for (const [name, pages] of Object.entries(DATASETS)) {
  if (only && !only.includes(name)) continue;
  const dir = join(outRoot, name);
  mkdirSync(join(dir, 'pages'), { recursive: true });
  const exported: { index: number; width: number; height: number; kind: string; seed: number; messiness: string; strokes: unknown[] }[] = [];
  const reference: string[] = [];
  pages.forEach((spec, i) => {
    const scene = buildScene(spec.kind, spec.seed, spec.messiness);
    const index = i + 1;
    exported.push({ index, width: scene.width, height: scene.height, kind: scene.kind, seed: scene.seed, messiness: scene.messiness, strokes: scene.strokes });
    // renderStrokesToPng pads by RENDER_PAD; shrink the bounds so the PNG covers exactly the page.
    const bounds = { left: RENDER_PAD, top: RENDER_PAD, right: scene.width - RENDER_PAD, bottom: scene.height - RENDER_PAD };
    const png = renderStrokesToPng(scene.strokes, bounds, { createCanvas: nodeCanvas });
    if (!png) throw new Error(`could not render ${name} page ${index}`);
    writeFileSync(join(dir, 'pages', `page-${index}.png`), Buffer.from(png.dataUrl.split(',')[1], 'base64'));
    reference.push(`<!-- page ${index} -->\n<!-- ${scene.title}: ${scene.figures.map((f) => f.description).join('; ')} -->\n${sceneReference(scene)}`);
    process.stderr.write(`${name} page ${index}: ${scene.kind} seed ${scene.seed} ${scene.messiness}, ${scene.strokes.length} strokes, ${scene.figures.length} figure(s), ${png.size.width}x${png.size.height}\n`);
  });
  writeFileSync(join(dir, 'strokes.json'), JSON.stringify({ source: `${name} (synthetic, scripts/gen_shapes.ts)`, pages: exported }));
  writeFileSync(join(dir, 'reference.md'), reference.join('\n'));
}
