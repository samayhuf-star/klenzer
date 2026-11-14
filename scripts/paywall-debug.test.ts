import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => readFileSync(join(root, rel), 'utf8');

describe('paywall store debug line', () => {
  it('is not rendered in the shipping paywall', () => {
    const paywall = src('src/app/paywall.tsx');
    assert.doesNotMatch(paywall, /paywall-debug/);
    assert.doesNotMatch(paywall, /storeDebugLine|onStoreDebugChange|getStoreDebug/);
    assert.doesNotMatch(paywall, /styles\.debug/);
  });

  it('still fetches subs and in-app in separate try blocks', () => {
    const p = src('src/lib/purchases.ts');
    const subs = p.indexOf("type: 'subs' })");
    const inApp = p.indexOf("type: 'in-app' })");
    assert.ok(subs > 0 && inApp > subs);
  });
});

describe('Compress is removed from 1.1.0', () => {
  it('has no reachable Compress tile, tab or coming soon copy on Home', () => {
    const home = src('src/app/index.tsx');
    assert.doesNotMatch(home, /Compress/);
    assert.doesNotMatch(home, /coming soon/i);
    assert.doesNotMatch(home, /setTab\(/);
  });
});
