import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { freeTrialDays, trialHint } from '../src/lib/introOffer';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

const weekTrial = { subscriptionOffers: [{ type: 'introductory', paymentMode: 'free-trial', period: { unit: 'week', value: 1 }, periodCount: 1 }] };
const dayTrial = { subscriptionOffers: [{ type: 'introductory', paymentMode: 'free-trial', period: { unit: 'day', value: 7 }, periodCount: 1 }] };
const paidIntro = { subscriptionOffers: [{ type: 'introductory', paymentMode: 'pay-as-you-go', period: { unit: 'month', value: 1 }, periodCount: 3 }] };
const legacyIOS = { introductoryPricePaymentModeIOS: 'free-trial', introductoryPriceSubscriptionPeriodIOS: 'week', introductoryPriceNumberOfPeriodsIOS: '1' };

describe('7-day free trial copy', () => {
  it('reads the trial length from the store offer', () => {
    assert.equal(freeTrialDays(weekTrial), 7);
    assert.equal(freeTrialDays(dayTrial), 7);
    assert.equal(freeTrialDays(legacyIOS), 7);
    assert.equal(freeTrialDays(paidIntro), null);
    assert.equal(freeTrialDays({ introductoryPricePaymentModeIOS: 'empty' }), null);
    assert.equal(freeTrialDays({}), null);
    assert.equal(freeTrialDays(null), null);
  });

  it('eligible user with a trial: "7 days free, then <price>/month, cancel anytime" (or /year)', () => {
    assert.equal(
      trialHint({ price: '$3.99', kind: 'monthly', trialDays: 7, fallback: 'Cancel any time.' }),
      '7 days free, then $3.99/month, cancel anytime',
    );
    assert.equal(
      trialHint({ price: '19,99 €', kind: 'yearly', trialDays: 7, fallback: 'Billed once a year. Cancel any time.' }),
      '7 days free, then 19,99 €/year, cancel anytime',
    );
  });

  it('no trial, not eligible, or lifetime: the fallback copy stays, with no trial text', () => {
    assert.equal(trialHint({ price: '$3.99', kind: 'monthly', trialDays: null, fallback: 'Cancel any time.' }), 'Cancel any time.');
    assert.equal(trialHint({ price: '$19.99', kind: 'yearly', fallback: 'Billed once a year. Cancel any time.' }), 'Billed once a year. Cancel any time.');
    assert.equal(
      trialHint({ price: '$29.99', kind: 'lifetime', trialDays: 7, fallback: 'Pay once, clean forever.' }),
      'Pay once, clean forever.',
    );
  });

  it('trial days are only set when StoreKit says the user is eligible', () => {
    const src = read('src/lib/purchases.ts');
    assert.match(src, /const trialDays = days && \(await introEligible\(product\)\) \? days : null;/);
    assert.match(src, /isEligibleForIntroOfferIOS\(group\)/);
    const fn = src.slice(src.indexOf('async function introEligible'), src.indexOf('export async function loadPlans'));
    assert.match(fn, /catch[\s\S]*return false/);
    assert.match(read('src/app/paywall.tsx'), /trialHint\(/);
    assert.match(read('src/lib/introOffer.ts'), /plan\.price/);
  });

  it('StoreKit test config: monthly 3.99 and yearly 19.99 have a 1-week free intro; lifetime 29.99 has none', () => {
    const sk = JSON.parse(read('qa/Klenzer.storekit'));
    const subs = sk.subscriptionGroups[0].subscriptions;
    const sub = (id: string) => subs.find((x: { productID: string }) => x.productID === id);
    assert.equal(sub('com.krosz.klenzer.monthly').displayPrice, '3.99');
    assert.equal(sub('com.krosz.klenzer.yearly').displayPrice, '19.99');
    for (const id of ['com.krosz.klenzer.monthly', 'com.krosz.klenzer.yearly']) {
      const s = sub(id);
      assert.deepEqual({ mode: s.introductoryOffer.paymentMode, period: s.introductoryOffer.subscriptionPeriod }, { mode: 'free', period: 'P1W' }, id);
    }
    const life = sk.products.find((x: { productID: string }) => x.productID === 'com.krosz.klenzer.lifetime');
    assert.equal(life.displayPrice, '29.99');
    assert.equal(life.introductoryOffer, undefined);
  });
});
