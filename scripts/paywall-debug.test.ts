import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => readFileSync(join(root, rel), 'utf8');

describe('paywall store debug line', () => {
  it('is always rendered as small, selectable grey text with a stable testID', () => {
    const paywall = src('src/app/paywall.tsx');
    assert.match(paywall, /<Text selectable style=\{styles\.debug\} testID="paywall-debug">/);
    assert.match(paywall, /debug: \{ fontSize: 10,[^}]*color: '#8E8E93'/);
  });

  it('fetches subs and in-app in separate try blocks and records each result or error', () => {
    const p = src('src/lib/purchases.ts');
    const subs = p.indexOf("type: 'subs' })");
    const inApp = p.indexOf("type: 'in-app' })");
    assert.ok(subs > 0 && inApp > subs);
    const between = p.slice(subs, inApp);
    assert.match(between, /\} catch \(e\) \{\s*storeDebug\.subs = \{ ok: false/);
    assert.match(p, /storeDebug\.inApp = \{ ok: false/);
    assert.match(p, /storeDebug\.catalogSize = byId\.size/);
    assert.match(p, /last error none/);
  });
});
