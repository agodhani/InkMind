import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mlMap } from './model';
import { starterProjects, validateProjects } from './projects';
import { checkProjectFiles } from './projects.node';
import { matchNotes } from './match';
import { planPath } from './plan';

const empty = { graph: { concepts: [], edges: [] }, extractions: [] };
const valid = () => ({ ...structuredClone(starterProjects[0]), files: ['README.md'], solutionFiles: ['solution.py'] });
describe('starter project manifests', () => {
  it('validates the real manifest and keeps solutions outside learner exports', async () => {
    expect(validateProjects(mlMap, starterProjects)).toEqual([]);
    expect(await checkProjectFiles(starterProjects)).toEqual([]);
    expect(starterProjects[0].files.some(file => file.startsWith('solution/'))).toBe(false);
    expect(validateProjects(mlMap, [valid()])).toEqual([]);
    expect(validateProjects(mlMap, [])).toEqual([]);
  });
  it.each([
    { concepts: ['unknown'] }, { stage: 'unknown' }, { files: [] },
    { solutionFiles: ['README.md'] }, { mapId: 'other' }, { dir: '../outside' },
    { files: ['../outside'] }, { solutionFiles: ['/absolute'] },
  ])('rejects invalid manifests %j', change => {
    expect(validateProjects(mlMap, [{ ...valid(), ...change }]).length).toBeGreaterThan(0);
  });
  it('rejects duplicate ids', () => expect(validateProjects(mlMap, [valid(), valid()])).toContain('Duplicate project id: rlhf-rlvr-toy'));
  it('checks export and solution files, missing paths and directories', async () => {
    const root = await mkdtemp(join(tmpdir(), 'inkmind-project-'));
    const project = { ...valid(), dir: 'project' };
    try {
      await mkdir(join(root, project.dir));
      expect(await checkProjectFiles([project], root)).toHaveLength(2);
      await writeFile(join(root, project.dir, 'README.md'), 'starter');
      await writeFile(join(root, project.dir, 'solution.py'), 'solution');
      expect(await checkProjectFiles([project], root)).toEqual([]);
      expect(await checkProjectFiles([{ ...project, files: ['.'] }], root)).toHaveLength(1);
      expect(await checkProjectFiles([{ ...project, dir: '..' }], root)).toHaveLength(2);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
describe('project evidence', () => {
  const result = { projectId: 'rlhf-rlvr-toy', concepts: ['ppo'], passed: true };
  it('ignores failed results and preserves default matches byte-for-byte', () => {
    expect(JSON.stringify(matchNotes(mlMap, empty, [], [{ ...result, passed: false }]))).toBe(JSON.stringify(matchNotes(mlMap, empty)));
    expect(matchNotes(mlMap, empty, [], [{ ...result, concepts: ['unknown'] }])).toEqual(matchNotes(mlMap, empty));
  });
  it('marks passed concepts known, separate from declarations and notes, with truthful skip reasons', () => {
    const matches = matchNotes(mlMap, empty, [], [result]);
    expect(matches.find(m => m.conceptId === 'ppo')).toMatchObject({ state: 'known', basis: 'project', declared: false, projectPassed: true, evidence: [{ kind: 'project', projectId: result.projectId }] });
    const plan = planPath(mlMap, ['ppo'], matches);
    expect(plan.steps).toEqual([]);
    expect(plan.skipped.find(s => s.conceptId === 'ppo')?.reason).toBe('you passed the project rlhf-rlvr-toy');
    expect(plan.skipped.find(s => s.conceptId === 'gae')?.reason).toContain('you passed the project rlhf-rlvr-toy');
  });
  it('uses note > project > declared precedence while keeping project evidence', () => {
    expect(matchNotes(mlMap, empty, ['ppo'], [result]).find(m => m.conceptId === 'ppo')).toMatchObject({ basis: 'project', declared: true, projectPassed: true });
    const notes = { graph: { concepts: [{ id: 'n', label: 'PPO', aliases: [], provenance: [] }], edges: [] }, extractions: [] };
    const matches = matchNotes(mlMap, notes, ['ppo'], [result, result]);
    const ppo = matches.find(m => m.conceptId === 'ppo')!;
    expect(ppo).toMatchObject({ basis: 'notes', declared: true, projectPassed: true });
    expect(ppo.evidence.map(e => e.kind)).toEqual(['note', 'project']);
    expect(planPath(mlMap, ['ppo'], matches).skipped.find(s => s.conceptId === 'ppo')?.reason).toBe('your notes cover it');
  });
  it('retains project evidence on done replan steps', () => {
    const initial = planPath(mlMap, ['ppo'], matchNotes(mlMap, empty));
    const replanned = planPath(mlMap, ['ppo'], matchNotes(mlMap, empty, [], [result]), initial);
    expect(replanned.steps.every(s => s.status === 'done')).toBe(true);
    expect(replanned.steps.find(s => s.conceptId === 'ppo')?.evidence).toEqual([{ kind: 'project', projectId: result.projectId }]);
  });
});
