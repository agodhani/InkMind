import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { mlCatalog } from '../src/path/resources';

const exec = promisify(execFile);
const report: { url: string; status: number; finalUrl: string; title: string; date: string; contentType?: string; error?: string }[] = [];
const pending = [...mlCatalog.resources];
async function worker() {
  for (let resource = pending.shift(); resource; resource = pending.shift()) {
    const date = new Date().toISOString().slice(0, 10);
    try {
      const { stdout } = await exec('curl', ['-L', '-sS', '--max-time', '60', '--max-redirs', '8', '-A', 'Mozilla/5.0 (compatible; InkMind resource link checker)', '-w', '\nINKMIND_META%{json}', resource.url], { maxBuffer: 20 * 1024 * 1024 });
      const split = stdout.lastIndexOf('\nINKMIND_META');
      const body = stdout.slice(0, split);
      const meta = JSON.parse(stdout.slice(split + '\nINKMIND_META'.length));
      const contentType: string = meta.content_type ?? '';
      const rawTitle = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
        ?? body.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)/i)?.[1] ?? '';
      const title = contentType.includes('application/pdf') ? 'PDF (application/pdf)' : rawTitle.replace(/\s+/g, ' ').trim();
      report.push({ url: resource.url, status: meta.http_code, finalUrl: meta.url_effective, title, date, contentType });
      console.log(`${meta.http_code} ${resource.id}: ${title || '(no title)'}`);
    } catch (error) {
      report.push({ url: resource.url, status: 0, finalUrl: resource.url, title: '', date, error: String(error) });
      console.error(`ERROR ${resource.id}: ${String(error)}`);
    }
  }
}
await Promise.all(Array.from({ length: 3 }, worker));
report.sort((a, b) => a.url.localeCompare(b.url));
const directory = fileURLToPath(new URL('../eval/resources/', import.meta.url));
await mkdir(directory, { recursive: true });
await writeFile(directory + 'link-check.json', JSON.stringify(report, null, 2) + '\n');
const dead = report.filter(r => r.status < 200 || r.status >= 300);
console.log(`links:check: ${report.length} checked, ${report.length - dead.length} passed, ${dead.length} dead`);
if (dead.length) process.exitCode = 1;
