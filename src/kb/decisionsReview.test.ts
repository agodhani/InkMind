import { expect, it } from 'vitest';
import { applyDecisions, deleteConcept, emptyDecisions, mergeConcept, renameConcept } from './decisions';
import { demoGraph } from './mapView';

const graph = () => {
  const g = demoGraph(3);
  g.concepts.forEach((c, i) => { c.label = ['Alpha', 'Beta', 'Gamma'][i]; });
  return g;
};
it('keeps a merge into a renamed target after that rename is replaced', () => {
  let d = renameConcept(emptyDecisions(), 'Beta', 'Second');
  d = mergeConcept(d, 'Alpha', 'Second');
  d = renameConcept(d, 'Second', 'Primary');
  expect(applyDecisions(graph(), d).concepts.map(c => c.label)).toEqual(['Primary', 'Gamma']);
});
it('keeps a renamed source in a merge chain after another rename', () => {
  let d = renameConcept(emptyDecisions(), 'Alpha', 'First');
  d = mergeConcept(d, 'First', 'Beta');
  d = renameConcept(d, 'First', 'Primary');
  d = mergeConcept(d, 'Beta', 'Gamma');
  expect(applyDecisions(graph(), d).concepts.map(c => c.label)).toEqual(['Gamma']);
});
it.each(['target', 'renamed target', 'chain'])('deletes all merged sources when deleting the %s', mode => {
  let d = emptyDecisions();
  if (mode === 'renamed target') d = renameConcept(d, 'Beta', 'Second');
  d = mergeConcept(d, 'Alpha', mode === 'renamed target' ? 'Second' : 'Beta');
  if (mode === 'chain') d = mergeConcept(d, 'Beta', 'Gamma');
  d = deleteConcept(d, mode === 'chain' ? 'Gamma' : mode === 'renamed target' ? 'Second' : 'Beta');
  expect(applyDecisions(graph(), d).concepts.map(c => c.label)).toEqual(mode === 'chain' ? [] : ['Gamma']);
});
