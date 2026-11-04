import { createPage, newId, type InkStroke, type Page } from './page';

/** Shape written by scripts/pdf_to_strokes.py; a bare `{ strokes }` is accepted too. */
export interface StrokeExport {
  source?: string;
  pages?: { index?: number; strokes: InkStroke[] }[];
  strokes?: InkStroke[];
}

/** Turn an exported stroke file into fresh pages (new ids, so imports never collide). */
export function pagesFromStrokeExport(data: StrokeExport, fallbackTitle = 'Imported'): Page[] {
  const title = (data.source ?? fallbackTitle).replace(/\.(pdf|json)$/i, '');
  const sources = data.pages ?? (data.strokes ? [{ index: 1, strokes: data.strokes }] : []);
  return sources
    .filter((p) => Array.isArray(p.strokes) && p.strokes.length > 0)
    .map((p, i) => {
      const page = createPage(sources.length > 1 ? `${title} · p${p.index ?? i + 1}` : title);
      page.strokes = p.strokes.map((s) => ({ ...s, id: newId('s') }));
      return page;
    });
}
