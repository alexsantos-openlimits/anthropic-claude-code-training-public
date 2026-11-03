# SPEC · NWP-201 — Issue virtual cards from the console

**Ticket:** [NWP-201](../tickets/NWP-201.md) · **Author:** Adam Raabe · **Status:** building

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand.
Hours each time, twelve to twenty times a week, and last month two cards were
created with the wrong spend limit because the request lived in a Slack thread.
Marcus wants it in the console.

## Current state

- `src/data/types.ts` — `Merchant` carries `currency` and `riskTier`; `Payment`
  carries `amount` as integer minor units, `last4`, and a UTC `createdAt`. No card type.
- `src/data/store.ts` — the in-memory store on `globalThis`, built by `createStore()`
  from `generate()`. Adding a `cards` array means extending `Store` and that factory.
- `src/data/merchants.ts` — ten merchants, each with its own settlement `currency`.
- `src/lib/money.ts` — `formatMoney`, `parseAmountToMinorUnits`. Reuse; do not add a formatter.
- `src/lib/dates.ts` — `formatDate`, `formatInZone`, UTC helpers. Reuse.
- `src/data/queries.ts` — the one query builder. Cards get their own lookups beside it,
  in `src/data/cards.ts`, following the same shape.
- `src/components/` — Button, Input, Select, Drawer, Table, Badge. No new dependency.
- `.claude/rules/cards.md` — 4242 BIN, Luhn, generate server-side, reveal once,
  mask everywhere else, status guarded on the server.

## Domain rules

| Rule | Source | What breaks |
| --- | --- | --- |
| Limits are integer minor units with a currency | ORG #1, `money.md` | cents drift |
| Format once, at the edge | ORG #2 | a formatted string re-enters arithmetic |
| Validate on the server against an allowlist | ORG #7, `api-routes.md` | a client sets any limit it likes |
| Full number in the creation response only | ORG #8, `cards.md` | a PAN leaks into a list payload |
| `active ⇄ frozen`, either → `cancelled`, terminal | `cards.md` | a cancelled card comes back |
| Every generated number is `4242` + valid Luhn | `cards.md` | something resembles a real PAN |

## Approach

Pure logic in `src/lib/cards.ts` (Luhn, generation, masking, the transition table) so
it is testable without a DOM. Store access and the audit trail in `src/data/cards.ts`.
Routes validate everything from the client against allowlists, then call those.
The UI is a Drawer issue form on `/cards`, a table, and a detail page — all from
existing components.

**Considered and rejected:** generating the number in the browser and posting it.
Rejected outright: `cards.md` calls that a bug, and it would put a PAN in client state.

## The five the ticket does not spell out

The ticket says the reviewer credits "work the ticket did not spell out … the things
an ops tool actually needs once real people click it twice, pick the wrong currency,
or ask what happened to a card last Tuesday." Reading the code, that is:

1. **Idempotent issue** — a double-click makes one card. The client sends an
   idempotency key; the route returns the first card for a repeated key.
   Touches `src/app/api/cards/route.ts`, `src/data/cards.ts`.
2. **Currency must match the merchant** — every merchant in `src/data/merchants.ts`
   has one settlement currency. A card in another currency cannot settle. Rejected 400.
3. **Honest spend** — a new card has spent nothing. `spent: 0`, never invented.
   Shown against the limit on the detail page.
4. **Confirmed cancel** — `cancelled` is terminal, so the UI confirms before it,
   and the server refuses any transition out of it.
5. **Audit trail** — every create, freeze, unfreeze and cancel appends
   `{at, action, from, to}` in UTC, shown on the detail page. That is the answer to
   "what happened to this card last Tuesday".

## File map

| File | Add / change | Why |
| --- | --- | --- |
| `src/lib/cards.ts` | add | Luhn, generation, masking, transition table |
| `src/lib/cards.test.ts` | add | the above, beside the code |
| `src/data/types.ts` | change | `Card`, `CardStatus`, `CardEvent` |
| `src/data/store.ts` | change | `cards: Card[]` |
| `src/data/cards.ts` | add | store lookups, create, transition, audit |
| `src/app/api/cards/route.ts` | add | GET list, POST issue with allowlists |
| `src/app/api/cards/[id]/route.ts` | add | GET one, POST status change |
| `src/app/cards/page.tsx` | add | the list |
| `src/app/cards/[id]/page.tsx` | add | detail, spend, audit trail |
| `src/app/cards/issue-dialog.tsx` | add | the issue form and the one-time reveal |
| `src/app/siteConfig.ts` / sidebar | change | a Cards nav entry |

## Verification

| Criterion | Proven by |
| --- | --- |
| Issue a card | curl POST, then the card in GET /api/cards and on /cards |
| List | /cards renders nickname, merchant, masked number, limit, status, date |
| Detail + spend | /cards/<id> shows spend against limit |
| 4242 + Luhn | `cards.test.ts` checks the prefix and the check digit |
| Reveal once | the number is in the POST body only; GET payloads carry `last4` |
| Server validation | curl: no merchant, limit 0, limit 5000001, currency JPY → 400 each |
| Idempotency | the same key twice → one card |
| Currency match | USD card on a GBP merchant → 400 |
| Status machine | cancelled → active → 400 |

## Risks

- The clock. Core first, stretch only after `npm test` is green.
- `generate()` returns a fixed shape; `cards` starts empty rather than seeded.

## Out of scope

Persistence (NWP-203), auth, real network calls, editing a limit (NWP-202).
