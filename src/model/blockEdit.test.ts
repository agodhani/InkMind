import { expect, it } from 'vitest';
import { withEditedText } from './blockEdit';
import type { DigitalBlock } from './page';

const block = (kind: DigitalBlock['kind']) => ({ id: 'b', kind, text: 'old', strokeIds: [], bbox: { x: 0, y: 0, width: 1, height: 1 }, confidence: 0.4 }) as unknown as DigitalBlock;

it('turns a paragraph edited to "# Title" into a heading and leaves other edits alone', () => {
  expect(withEditedText(block('paragraph'), '## Markov decision process')).toMatchObject({ kind: 'heading', level: 2, text: 'Markov decision process', userEdited: true, confidence: 1 });
  expect(withEditedText(block('unknown'), '# A')).toMatchObject({ kind: 'heading', level: 1, text: 'A' });
  expect(withEditedText(block('paragraph'), 'C# is a language')).toMatchObject({ kind: 'paragraph', text: 'C# is a language' });
  expect(withEditedText(block('paragraph'), '#### too deep')).toMatchObject({ kind: 'paragraph' });
  expect(withEditedText(block('list'), '# not a heading')).toMatchObject({ kind: 'list', text: '# not a heading' });
  expect(withEditedText(block('heading'), 'Renamed')).toMatchObject({ kind: 'heading', text: 'Renamed' });
});
