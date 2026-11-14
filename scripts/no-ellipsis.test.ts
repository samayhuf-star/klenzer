import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.ts') || full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/** Strip comments, then look at quotes on a single line so spreads like `[...ids]` are ignored. */
function stringLiteralsOnLine(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch;
      let j = i + 1;
      let text = '';
      while (j < line.length && line[j] !== q) {
        if (line[j] === '\\') {
          text += line[j] + (line[j + 1] ?? '');
          j += 2;
          continue;
        }
        text += line[j++];
      }
      if (j < line.length) out.push(text);
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return out;
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('user-facing copy has no ellipsis', () => {
  it('fails if any string literal in src/ contains … or ...', () => {
    const hits: string[] = [];
    for (const file of walk(root)) {
      const rel = file.replace(root + '/', 'src/');
      const source = stripComments(readFileSync(file, 'utf8'));
      source.split('\n').forEach((line, idx) => {
        for (const text of stringLiteralsOnLine(line)) {
          if (text.includes('…') || text.includes('...')) {
            hits.push(`${rel}:${idx + 1}: ${JSON.stringify(text).slice(0, 120)}`);
          }
        }
      });
    }
    assert.deepEqual(hits, [], hits.join('\n'));
  });
});
