# Klenzer ASC pricing — 12 November 2026

App: Klenzer (ASC 6820685404), products `com.krosz.klenzer.lifetime` and `com.krosz.klenzer.monthly`.  
Time: 13:50 Asia/Dhaka (UTC+6).  
Scope: agreement/tax/bank readout, then IAP price schedules. No review submission. Builds, TestFlight, and the 1.1.0 build attachment were not touched.

## Step 1 — read-only states

### Paid Applications agreement, tax, and banking
There is still no App Store Connect API resource for these. Probed and got HTTP 404 `NOT_FOUND` ("The path provided does not match a defined resource type") for:

- `/v1/agreements` (including `filter[agreementType]=PAID_APPS` and `PAID_APPLICATIONS`)
- `/v1/contracts`
- `/v1/contractMessages`
- `/v1/taxForms`
- `/v1/bankAccounts`
- `/v1/bankingInformations`
- `/v1/businessEntities`

`/v1/actors` returned 400 (requires `filter[id]`). `/v1/users` and `/v1/apps/6820685404` work, but neither exposes agreement, tax, or banking status. The API therefore cannot confirm that Paid Apps is Active, or that tax and banking are not pending.

### Territory availability
`GET /v1/apps/6820685404/appAvailabilityV2` → `availableInNewTerritories: true`.  
`GET /v2/appAvailabilities/6820685404/territoryAvailabilities` → **175 / 175** territories, all `available: true`, all with the same `contentStatuses`:

| contentStatuses | Count |
| --- | ---: |
| `CANNOT_SELL`, `AVAILABLE_FOR_SALE_UNRELEASED_APP` | 175 |

Individual counts: `CANNOT_SELL` 175, `AVAILABLE_FOR_SALE_UNRELEASED_APP` 175. No `MISSING_CONTRACT` (or any other status). Non-`CANNOT_SELL` count: **0**.

### IAP price-schedule reads
These endpoints now accept reads (HTTP 200):

- Lifetime price schedule, base territory, manual and automatic prices, USA price points, and in-app purchase availability
- Monthly subscription record, all 175 subscription prices, USA price points, and subscription availability

### Decision to continue to step 2
`CANNOT_SELL` is still present on every territory, but it is paired only with `AVAILABLE_FOR_SALE_UNRELEASED_APP`, every territory is `available: true`, and no status points to an agreement, tax, or banking problem. The same `contentStatuses` pair appears on Klarity, another unreleased app on this account, and is the documented pre-release state (the app cannot be sold until it is live). I therefore treated this as the unreleased-app status, not an agreement block, and continued to step 2. Agreement/tax/banking themselves remain unreadable from the API; this decision is from that indirect evidence.

## Step 2 — actions

USA was used as the base territory. Apple automatic equalization was used, with no new manual overrides.

### `com.krosz.klenzer.lifetime` (non-consumable)
Before: base territory USA; **two manual prices** — USA $14.99 and **India ₹599.00** (a manual override); 173 automatic prices; available in all 175 territories (`availableInNewTerritories: true`).

Action: `POST /v1/inAppPurchasePriceSchedules` with base territory USA and a single manual price, the USA $14.99 price point. Result: HTTP 201. Availability was already all 175 territories, so it was left unchanged.

After: India is no longer manual. It now uses Apple’s equalized automatic price (₹1,499.00). Manual prices: USA only.

### `com.krosz.klenzer.monthly` (auto-renewable subscription)
Before: USA $3.99 already set; prices present in all 175 App Store territories; all 174 non-USA prices already matched `GET /v1/subscriptionPricePoints/{USA $3.99}/equalizations`. Available in all 175 territories.

Action: no subscription price POSTs and no availability change. Replacing already-correct prices would have risked leaving the product without a price for no gain.

### Bangladesh
Apple’s territory catalog has **175** storefronts and does **not** include Bangladesh (`BGD` / `BD`). No territory uses currency BDT. There is no BD price to set or read back.

## Readback

Both products remain `READY_TO_SUBMIT`. Nothing was submitted for review.

### Lifetime — base USA, 1 manual + 174 automatic, available in 175 territories

| Territory | Source | Customer price | Currency | Proceeds |
| --- | --- | --- | --- | --- |
| USA | manual | 14.99 | USD | 12.74 |
| India (IND) | automatic | 1499.00 | INR | 1079.79 |
| Bangladesh (BD) | — | no App Store territory | — | — |
| United Kingdom (GBR) | automatic | 14.99 | GBP | 10.59 |
| Germany (DEU) | automatic | 17.99 | EUR | 12.85 |
| France (FRA) | automatic | 17.99 | EUR | 12.74 |

India changed from a manual ₹599.00 to Apple’s equalized ₹1,499.00. GB/DE/FR automatic prices were already the equalized values and are unchanged.

### Monthly — 175 territory prices, available in 175 territories, 0 mismatches vs USA $3.99 equalizations

| Territory | Customer price | Currency | Proceeds |
| --- | --- | --- | --- |
| USA | 3.99 | USD | 3.39 |
| India (IND) | 399.00 | INR | 287.42 |
| Bangladesh (BD) | no App Store territory | — | — |
| United Kingdom (GBR) | 3.99 | GBP | 2.82 |
| Germany (DEU) | 3.99 | EUR | 2.85 |
| France (FRA) | 3.99 | EUR | 2.83 |

These are Apple’s equalized prices for the USA $3.99 point, not 1:1 currency conversion (for example GBP stays 3.99, INR is 399.00).
