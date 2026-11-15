import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { isPhotoDeleteCancelled } from '../src/lib/delete-cancel';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => readFileSync(join(root, rel), 'utf8');

describe('photo delete cancel', () => {
  it('treats the Photos Don’t Allow rejection as a cancel, and other failures as errors', () => {
    const wrapped = Object.assign(
      new Error("Couldn't remove assets: The operation couldn’t be completed. (PHPhotosErrorDomain error 3072.)"),
      { code: 'ERR_REMOVE_ASSETS' },
    );
    assert.equal(isPhotoDeleteCancelled(wrapped), true);
    assert.equal(isPhotoDeleteCancelled({ code: 3072, message: 'The operation was cancelled.' }), true);
    assert.equal(isPhotoDeleteCancelled({ code: '3072' }), true);
    assert.equal(isPhotoDeleteCancelled(new Error("Couldn't remove assets: The operation was cancelled.")), true);
    assert.equal(isPhotoDeleteCancelled(new Error("Couldn't remove assets: The operation was canceled.")), true);
    assert.equal(isPhotoDeleteCancelled(new Error('User cancelled.')), true);
    assert.equal(
      isPhotoDeleteCancelled({ code: 'ERR_REMOVE_ASSETS', message: "Couldn't remove assets", cause: { code: 3072 } }),
      true,
    );
    assert.equal(isPhotoDeleteCancelled(new Error("Couldn't remove assets: unspecified error")), false);
    assert.equal(isPhotoDeleteCancelled(new Error('Media Library permission is required to do this operation')), false);
    assert.equal(
      isPhotoDeleteCancelled({ code: 'ERR_REMOVE_ASSETS', message: "Couldn't remove assets: (PHPhotosErrorDomain error 3164.)" }),
      false,
    );
  });

  it('maps a cancel rejection to the false result, and a real failure still throws', () => {
    const scanner = src('src/lib/scanner.ts');
    assert.match(scanner, /if \(isPhotoDeleteCancelled\(error\)\) return false/);
    assert.match(scanner, /throw error/);
  });

  it('shows a calm cancelled screen and stops spinners on a real error', () => {
    const store = src('src/lib/store.tsx');
    const cleaning = src('src/app/cleaning.tsx');
    assert.match(store, /note: 'Not deleted'/);
    assert.match(store, /phase: 'cancelled'/);
    assert.match(store, /status: 'pending', note: 'Not removed'/);
    assert.match(store, /phase: 'error'/);
    assert.match(cleaning, /Nothing was deleted/);
    assert.match(cleaning, /You cancelled the delete\. Your photos are untouched\./);
    assert.match(cleaning, /remove-circle-outline/);
    assert.match(cleaning, /Something went wrong/);
    assert.match(cleaning, /Nothing was removed\./);
    assert.match(cleaning, /label="Back"/);
    assert.match(cleaning, /router\.back\(\)/);
    assert.match(cleaning, /row\.status === 'active'/);
  });
});

describe('paywall on a short phone', () => {
  it('scrolls the plans and pins the purchase button below iPhone SE height', () => {
    const paywall = src('src/app/paywall.tsx');
    assert.match(paywall, /PIN_CTA_BELOW_HEIGHT = 740/);
    assert.match(paywall, /style=\{styles\.scroll\}/);
    assert.match(paywall, /scroll: \{ flex: 1, overflow: 'hidden' \}/);
    assert.match(paywall, /paddingBottom: pinCta \? 16 : insets\.bottom \+ 24/);
    assert.match(paywall, /paddingBottom: insets\.bottom \+ 12/);
    assert.match(paywall, /\{legal\}/);
    assert.match(paywall, /\{renewal\}/);
    assert.match(paywall, /testID="paywall-scroll"/);
    assert.match(paywall, /testID="unlock"/);
    assert.match(paywall, /Restore purchase/);
    assert.doesNotMatch(paywall, /\$3\.99/);
    assert.doesNotMatch(paywall, /\$19\.99/);
    assert.doesNotMatch(paywall, /\$29\.99/);
  });
});
