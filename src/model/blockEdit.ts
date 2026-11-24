import type { DigitalBlock } from './page';

/** A text correction; typing `# Title` (1-3 hashes) on a plain block turns it into a heading, as the transcriber would have. */
export function withEditedText(block: DigitalBlock, text: string): DigitalBlock {
  const edited = { ...block, text, userEdited: true, confidence: 1 };
  const heading = /^(#{1,3})[ \t]+(\S.*)$/.exec(text.trim());
  if (!heading || (block.kind !== 'paragraph' && block.kind !== 'unknown')) return edited;
  return { ...edited, kind: 'heading', level: heading[1].length, text: heading[2] };
}
