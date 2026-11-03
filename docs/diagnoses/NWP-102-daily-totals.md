# NWP-102 · Diagnosis

> Written before any code changed, as the ticket asks. Nothing here is fixed.
> Produced by four read-only investigators working in parallel, one per reported
> symptom, each with a second agent trying to refute its finding. Three survived
> refutation, one did not and is recorded under **Not the cause**.

**Diagnosis:** Four independent defects in `src/data/metrics.ts`, `src/data/generate.ts`,
`src/data/queries.ts` and `src/data/analytics.ts`, not one bug. The Berlin report is
timezone bucketing, the too-high report is a refund sign error plus currency mixing, and
the cents drift is a round-of-sum fee.

## Reported symptoms

| Report | Cause | Shares a cause with |
| --- | --- | --- |
| A — off by a few cents, growing with transaction count (2 merchants) | #3, payout fee rounding, with #4 as a second cents-losing site | each other only |
| B — a whole day of volume on the wrong date (Berlin) | #1, local-zone day keys | the payouts/payments date-window gap, same family: day keys built ad hoc instead of through `src/lib/dates.ts` |
| C — totals look too high (heavy refunds) | #2, refunds added and currencies mixed | nothing |

So: **three reports, three different causes.** They are not one bug.

## Root causes

**1. `src/data/metrics.ts:25` — day keys are built in the host's local timezone while the buckets are UTC. Confidence: high.**
`new Date(payment.createdAt).toLocaleDateString("en-CA")` passes no `timeZone`, so it resolves
against whatever zone the process runs in. The keys it looks up come from `lastUtcDays`
(`metrics.ts:18`, `src/lib/dates.ts:39-47`), which are UTC. Any key outside that set is dropped
silently at `metrics.ts:27` (`if (!bucket) continue`). `utcDayKey` (`dates.ts:7`) and
`dayKeyInZone` (`dates.ts:12`) already exist for exactly this and are used nowhere in the app.

**2. `src/data/metrics.ts:53-55` — refunds are added to gross volume instead of subtracted, and three currencies are summed into one number rendered as USD. Confidence: high.**
`captured.reduce(...) + refunded.reduce(...)`, taken over all of `store.payments` with no
merchant or currency filter, then displayed at `src/app/overview/page.tsx:29` as
`formatMoneyCompact(metrics.grossVolume, "USD")`.

**3. `src/data/generate.ts:175` — the 2.9% fee is rounded once over a whole batch rather than per payment. Confidence: high.**
`Math.round(gross * 0.029) + inPeriod.length * 30`. The gap against a per-payment settlement
grows with payment count, bounded by n × 0.5 cents, which matches "grows with transaction count".

**4. `src/data/analytics.ts:54` and `:58` — chart volume is divided by 100 and `Math.round`ed to whole major units, discarding cents outright. Confidence: high.**

Two more worth the reviewer's attention:

- **`src/data/queries.ts:52-53`** compares a caller's `from`/`to` lexically against a full ISO
  timestamp, so `to=2026-08-12` excludes that entire day. A second route to a whole-day
  discrepancy, and those params are unvalidated (`queries.ts:28-31`).
- **Payouts and payments share no code path.** `src/app/payouts/page.tsx:18` reads
  `store.payouts` straight through, frozen at boot by `generate.ts:154-192`, which
  re-implements merchant, status and date filtering inline at `:165-171`. That is a second
  query builder, against ORG-STANDARDS #6. This answers the ticket's open question: no, nobody
  has checked, and they cannot agree by construction.

## Evidence

The seed PRNG was replayed outside the app (SEED 20260813, no file edited):

| Timezone | Daily buckets that differ from correct UTC bucketing | Worst day |
| --- | --- | --- |
| UTC | 0 of 30 | — |
| America/New_York | 28 of 30 | 148,934 minor units |
| Europe/Berlin | 24 of 30 | 65,802 minor units |

**That is why Support cannot reproduce it.** On a UTC server the bug does not exist.

Captured totals are USD 19,536,955 + EUR 6,459,140 + GBP 6,182,707, with 2,710,607 refunded.
So cause #2 overstates the headline figure by 15.5%, and 39.3% of the number labelled "$" is
not USD at all (`src/data/merchants.ts:37,45,53` declare GBP and EUR merchants).

Across the 80 generated payout rows, batch-versus-per-payment fees differ by up to 2 minor units.

Rules broken: `src/lib/dates.ts:2`, `src/lib/money.ts:37-39`, `src/data/queries.ts:38-41`.

## Not the cause

**`metrics.ts:31` and `:34` accumulate `payment.amount / 100` as floats and re-round at
`:42-43`.** This is a real integer-minor-units violation and the most obvious suspect for
symptom A, which is why it was checked rather than assumed. It cannot produce these cents:
0 mismatches on the real seed, and 0 across 300 random trials of up to 50,000 payments per
bucket. A latent defect worth fixing, but not this ticket's cents.

## Suggested fix

One sentence each, no code, for whoever picks this up.

1. Bucket with the existing UTC day-key helper, and convert to the merchant's zone only at the display edge.
2. Net refunds out of gross volume, and group by currency before summing so each figure carries its own currency.
3. Compute the percentage fee per payment and sum the rounded results.
4. Keep chart series in minor units and divide once, in the formatter.
5. Route the payouts screen's filtering through the one query builder, and normalise bare date params to half-open UTC instants.

## Still unknown

Which timezone the reporting server actually runs in. Nothing in the repo pins `TZ`, so the
real-world size of symptom B per reporter cannot be settled read-only.

`dailyVolume()` is also global rather than per merchant (`overview/page.tsx:12`), so "exactly
one whole day" comes from the report rather than from the code.
