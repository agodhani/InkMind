import { writeFileSync } from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { SCENE_KINDS, buildScene } from '../src/sim/scenes';
import { RENDER_PAD, renderStrokesToPng, type CanvasFactory } from '../src/transcribe/render';
const nodeCanvas: CanvasFactory = (w, h) => createCanvas(w, h) as unknown as ReturnType<CanvasFactory>;
const only = process.argv[2];
for (const { kind } of SCENE_KINDS) {
  if (only && kind !== only) continue;
  for (const mess of ['normal', 'messy'] as const) {
    for (const seed of [1, 2, 3, 4]) {
      const scene = buildScene(kind, seed, mess);
      let oob = 0;
      for (const s of scene.strokes) for (const q of s.inputs.inputs) if (q.x < 0 || q.y < 0 || q.x > scene.width || q.y > scene.height) oob++;
      if (oob) console.log(`OOB ${kind} seed ${seed} ${mess}: ${oob} points, ${scene.width}x${scene.height}`);
      if (seed > 2) continue;
      const bounds = { left: RENDER_PAD, top: RENDER_PAD, right: scene.width - RENDER_PAD, bottom: scene.height - RENDER_PAD };
      const png = renderStrokesToPng(scene.strokes, bounds, { createCanvas: nodeCanvas });
      writeFileSync(`/tmp/preview/${kind}-${mess}-${seed}.png`, Buffer.from(png!.dataUrl.split(',')[1], 'base64'));
    }
  }
}
