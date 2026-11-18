import { expect, it } from 'vitest';
import { proposalText } from './ProposalReview';
import type { GraphProposal } from '../kb/model';
import { demoGraph } from '../kb/mapView';

it('describes aliases, claims and graph edges without exposing internal IDs', () => {
  const graph = demoGraph(2);
  const p: GraphProposal = { id: 'p', kind: 'alias', label: 'Topic', conceptId: 'demo-0', origin: 'model', status: 'proposed', provenance: [] };
  expect(proposalText(p, graph)).toBe('Knowledge topic 1 is also called Topic');
  expect(proposalText({ ...p, kind: 'proposition', label: 'A claim about this topic.' }, graph)).toBe('A claim about this topic.');
  expect(proposalText({ ...p, kind: 'edge', edgeId: graph.edges[0].id }, graph)).toBe('Knowledge topic 1 → mentions → Knowledge topic 2');
  expect(proposalText(p, { concepts: [], edges: [] })).toBe('This concept is also called Topic');
  expect(proposalText({ ...p, kind: 'edge', edgeId: 'missing' }, graph)).toBe('Topic');
});
