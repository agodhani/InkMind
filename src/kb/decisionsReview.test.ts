import { expect, it } from 'vitest';
import { applyDecisions, deleteConcept, emptyDecisions, mergeConcept, renameConcept } from './decisions';
import { demoGraph } from './mapView';

const graph = () => {
  const g = demoGraph(3);
  g.concepts.forEach((c, i) => { c.label = ['Alpha', 'Beta', 'Gamma'][i]; });
  return g;
};
it.each(['target', 'renamed target', 'chain'])('deletes all merged sources when deleting the %s', mode => {
  let d = emptyDecisions();
  if (mode === 'renamed target') d = renameConcept(d, 'Beta', 'Second');
  d = mergeConcept(d, 'Alpha', mode === 'renamed target' ? 'Second' : 'Beta');
  if (mode === 'chain') d = mergeConcept(d, 'Beta', 'Gamma');
  d = deleteConcept(d, mode === 'chain' ? 'Gamma' : mode === 'renamed target' ? 'Second' : 'Beta');
  expect(applyDecisions(graph(), d).concepts.map(c => c.label)).toEqual(mode === 'chain' ? [] : ['Gamma']);
});
