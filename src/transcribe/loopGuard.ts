export interface LoopMatch {
  start: number;
  keepUntil: number;
}

/** Repeated tail units or unbounded numeric enumeration, not distinct written labels. */
export function detectLoop(text: string): LoopMatch | undefined {
  const offset = Math.max(0, text.length - 4096);
  const tail = text.slice(offset);
  const repeated = /(.{3,160}?)(?:\1){5,}/gs;
  for (const match of tail.matchAll(repeated)) {
    if (!/[\p{L}\p{N}]/u.test(match[1])) continue;
    return { start: offset + match.index, keepUntil: offset + match.index + match[1].length };
  }
  for (const match of tail.matchAll(/\b\d+(?:\s*,\s*\d+){30,}/g)) {
    const values = match[0].split(',').map(Number);
    if (values.every((n, i) => i === 0 || n === values[i - 1] + 1)) {
      return { start: offset + match.index, keepUntil: offset + match.index + String(values[0]).length };
    }
  }
  return undefined;
}

/** Keep the longest JSON prefix that can be closed, dropping incomplete trailing properties. */
export function closeJsonPrefix(text: string): string {
  try { JSON.parse(text); return text; } catch { /* repair incomplete JSON */ }
  const start = text.search(/[[{]/);
  if (start < 0) return text;
  const source = text.slice(start);
  const stack: string[] = [];
  const candidates: { end: number; suffix: string }[] = [];
  let inString = false, escaped = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') {
      if (stack.pop() !== ch) break;
    }
    if (!escaped) candidates.push({ end: i + 1, suffix: (inString ? '"' : '') + [...stack].reverse().join('') });
  }
  for (const { end, suffix } of candidates.reverse()) {
    const candidate = source.slice(0, end).trimEnd() + suffix;
    try { JSON.parse(candidate); return candidate; } catch { /* try the previous complete value */ }
  }
  return text;
}
