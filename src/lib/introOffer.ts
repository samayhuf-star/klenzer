// Introductory free-trial copy for the paywall. Pure, no native imports, so it can be unit tested.

type Period = { unit?: string | null; value?: number | null } | null | undefined;
export interface OfferLike {
  type?: string | null;
  paymentMode?: string | null;
  period?: Period;
  periodCount?: number | null;
}
export interface ProductLike {
  subscriptionOffers?: OfferLike[] | null;
  introductoryPricePaymentModeIOS?: string | null;
  introductoryPriceSubscriptionPeriodIOS?: string | null;
  introductoryPriceNumberOfPeriodsIOS?: string | null;
}

const DAYS: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };

/** Length in days of the product's introductory free trial, or null when it has none. */
export function freeTrialDays(p: ProductLike | null | undefined): number | null {
  if (!p) return null;
  for (const o of p.subscriptionOffers ?? []) {
    if (o?.type !== 'introductory' || o.paymentMode !== 'free-trial') continue;
    const unit = o.period?.unit ?? '';
    const per = DAYS[unit];
    if (!per) continue;
    const days = per * (o.period?.value || 1) * (o.periodCount || 1);
    if (days > 0) return days;
  }
  if (p.introductoryPricePaymentModeIOS === 'free-trial') {
    const per = DAYS[p.introductoryPriceSubscriptionPeriodIOS ?? ''];
    const n = parseInt(p.introductoryPriceNumberOfPeriodsIOS ?? '1', 10) || 1;
    if (per) return per * n;
  }
  return null;
}

/**
 * Card/hint copy. Trial text is shown only when the store reported an eligible intro offer.
 * The price is always the store's localized display price. Lifetime never gets trial copy.
 */
export function trialHint(plan: {
  price: string;
  kind: 'monthly' | 'yearly' | 'lifetime';
  trialDays?: number | null;
  fallback: string;
}): string {
  if (plan.kind === 'lifetime' || !plan.trialDays || plan.trialDays <= 0) return plan.fallback;
  const period = plan.kind === 'yearly' ? 'year' : 'month';
  return `${plan.trialDays} days free, then ${plan.price}/${period}, cancel anytime`;
}
