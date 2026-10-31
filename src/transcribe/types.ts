import type { BoundingBox } from '../types';
import type { BlockKind, DigitalBlock, InkStroke } from '../model/page';

/** A line-ish cluster of strokes, sent as text metadata alongside the image. */
export interface StrokeGroupMeta {
  index: number;
  strokeIds: string[];
  bbox: BoundingBox;
  /** Order in which the group was written, 0 = first. */
  writtenOrder: number;
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
}

export interface TranscribeResult {
  blocks: RawBlock[];
  model: string;
  durationMs: number;
}

export interface Transcriber {
  readonly name: string;
  transcribe(request: TranscribeRequest, signal?: AbortSignal): Promise<TranscribeResult>;
}

export type { DigitalBlock };
