import type { BoundingBox } from '../types';
import type { BlockKind, DigitalBlock, FigureInfo, InkStroke } from '../model/page';
import type { FigureHint } from '../ink/shapeHints';

/** A line-ish cluster of strokes, sent as text metadata alongside the image. */
export interface StrokeGroupMeta {
  index: number;
  strokeIds: string[];
  bbox: BoundingBox;
  /** Order in which the group was written, 0 = first. */
  writtenOrder: number;
  /** Geometric hint from the shape pre-classifier, e.g. "closed shape: circle ~120 px". */
  hint?: string;
  /** The drawn figure this group is part of (shape, label inside it, arrow, axes…), shared by all its groups. */
  figure?: FigureHint;
}

export interface HandwritingExample {
  /** PNG data URL of an ink crop. */
  imageDataUrl: string;
  /** Verified transcription of that crop. */
  text: string;
}

export interface HandwritingProfile {
  glossary: string[];
  habits: string[];
  examples: HandwritingExample[];
}

export interface TranscribeRequest {
  /** PNG data URL of the rendered region. */
  imageDataUrl: string;
  /** Page-space bounds of the rendered image (so bboxes can be mapped back). */
  imageBounds: BoundingBox;
  /** Pixel size of the image. */
  imageSize: { width: number; height: number };
  strokes: InkStroke[];
  groups: StrokeGroupMeta[];
  /** Transcribed text of nearby blocks, for context. */
  contextText: string;
  pageTitle: string;
  profile: HandwritingProfile;
}

/** What the model returns, before ids/bboxes are normalised into DigitalBlocks. */
export interface RawBlock {
  kind: BlockKind;
  text: string;
  /** Bounding box in image pixel coordinates. */
  bbox: BoundingBox;
  /** Indices into TranscribeRequest.groups that make up this block. */
  groupIndices: number[];
  confidence: number;
  marker?: string;
  level?: number;
  /** Diagram blocks: structured figure description (optional, normalised leniently). */
  figure?: FigureInfo;
}

export interface TranscribeResult {
  blocks: RawBlock[];
  model: string;
  durationMs: number;
  /** Unparsed model reply, for debugging / eval. */
  raw?: string;
}

export interface Transcriber {
  readonly name: string;
  /** Optional model-specific render budget, shared by app and evaluator. */
  readonly maxImageEdge?: number;
  transcribe(request: TranscribeRequest, signal?: AbortSignal): Promise<TranscribeResult>;
}

export type { DigitalBlock };
