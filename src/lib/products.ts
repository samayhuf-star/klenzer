/** Store product catalog. Data-driven so a new product ID can be added without changing the paywall layout. */

export type PlanKind = 'yearly' | 'monthly' | 'lifetime';
export type StoreProductType = 'in-app' | 'subs';

export type ProductDef = {
  id: string;
  kind: PlanKind;
  type: StoreProductType;
  title: string;
  hint: string;
  /** Shown on the plan card, e.g. Best value. */
  badge?: string;
};

export const PRODUCT_CATALOG: ProductDef[] = [
  {
    id: 'com.krosz.klenzer.yearly',
    kind: 'yearly',
    type: 'subs',
    title: 'Yearly',
    hint: 'Billed once a year. Cancel any time.',
    badge: 'BEST VALUE',
  },
  {
    id: 'com.krosz.klenzer.monthly',
    kind: 'monthly',
    type: 'subs',
    title: 'Monthly',
    hint: 'Cancel any time.',
  },
  {
    id: 'com.krosz.klenzer.lifetime',
    kind: 'lifetime',
    type: 'in-app',
    title: 'Lifetime',
    hint: 'Pay once, clean forever.',
  },
];

export const productIds = (type?: StoreProductType) =>
  PRODUCT_CATALOG.filter((p) => (type ? p.type === type : true)).map((p) => p.id);

export const defForId = (id: string) => PRODUCT_CATALOG.find((p) => p.id === id) ?? null;

export const isKnownProduct = (id: string) => PRODUCT_CATALOG.some((p) => p.id === id);

/** Yearly is the default when it loaded; otherwise the first plan that the store returned. */
export function defaultPlanKind(kinds: PlanKind[]): PlanKind | null {
  if (!kinds.length) return null;
  return kinds.includes('yearly') ? 'yearly' : kinds[0];
}
