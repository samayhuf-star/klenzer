import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function src(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

function functionBody(source: string, name: string): string {
  const re = new RegExp(`(?:export )?async function ${name}\\s*\\([^)]*\\)\\s*(?::[^{]+)?\\{`);
  const m = re.exec(source);
  if (!m || m.index == null) throw new Error(`Could not find function ${name}`);
  let i = m.index + m[0].length;
  let depth = 1;
  const start = i;
  while (i < source.length && depth > 0) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
    i++;
  }
  return source.slice(start, i - 1);
}

/** First useEffect in store.tsx is the boot effect. */
function bootEffect(store: string): string {
  const marker = 'useEffect(() => {\n    (async () => {';
  const at = store.indexOf(marker);
  if (at < 0) throw new Error('Could not find the store boot effect');
  let i = store.indexOf('{', at);
  let depth = 0;
  const start = i;
  while (i < store.length) {
    if (store[i] === '{') depth++;
    else if (store[i] === '}') {
      depth--;
      if (depth === 0) return store.slice(start, i + 1);
    }
    i++;
  }
  throw new Error('Unclosed boot effect');
}

const PROMPTING = [/syncIOS\s*\(/, /storeRestore\s*\(/, /restorePurchases\s*\(/, /getAvailablePurchases\s*\(/];

describe('IAP startup must not prompt for Apple ID', () => {
  const purchases = src('src/lib/purchases.ts');
  const store = src('src/lib/store.tsx');
  const layout = src('src/app/_layout.tsx');

  it('initIAP only connects and listens — no sync, restore, or getAvailablePurchases', () => {
    const body = functionBody(purchases, 'initIAP');
    for (const re of PROMPTING) {
      assert.equal(re.test(body), false, `${re} must not run inside initIAP`);
    }
    assert.match(body, /ensureConnected|initConnection|attachListeners/);
  });

  it('refreshEntitlements uses current entitlements only — no sync or restore', () => {
    const body = functionBody(purchases, 'refreshEntitlements');
    for (const re of PROMPTING) {
      assert.equal(re.test(body), false, `${re} must not run inside refreshEntitlements`);
    }
    assert.match(body, /currentEntitlementIOS|hasActiveSubscriptions|getActiveSubscriptions/);
  });

  it('sync and restore run only from restore(), when the user taps Restore Purchases', () => {
    const body = functionBody(purchases, 'restore');
    assert.match(body, /syncIOS\s*\(/);
    assert.match(body, /storeRestore\s*\(/);
  });

  it('store boot marks ready before any IAP work and never calls sync or restore', () => {
    const boot = bootEffect(store);
    assert.doesNotMatch(boot, /syncIOS\s*\(/);
    assert.doesNotMatch(boot, /\brestore\s*\(/);
    assert.doesNotMatch(boot, /restorePurchases\s*\(/);
    assert.doesNotMatch(boot, /getAvailablePurchases\s*\(/);
    const readyAt = boot.indexOf('setReady(true)');
    const iapAt = boot.indexOf('initIAP(');
    assert.ok(readyAt >= 0, 'boot must call setReady(true)');
    assert.ok(iapAt < 0 || readyAt < iapAt, 'setReady(true) must run before initIAP so the splash does not wait on StoreKit');
  });

  it('the root layout does not keep a splash up for IAP, fonts, or an animated delay', () => {
    assert.doesNotMatch(layout, /AnimatedSplash/);
    assert.doesNotMatch(layout, /initIAP|refreshEntitlements|syncIOS|restorePurchases/);
    assert.doesNotMatch(layout, /loaded && ready/);
  });
});
