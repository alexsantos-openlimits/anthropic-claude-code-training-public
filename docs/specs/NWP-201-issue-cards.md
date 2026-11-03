# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Patrick
**Status:** done

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. That happens 12–20 times a week, takes hours each time, and last month two cards went out with the wrong spend limit because the request was buried in a Slack thread. Ops needs to issue a card, see every card they have issued, and open one to check it, all from the console.

## Current state

All paths are relative to `build-battle/merchant-console/`.

- `src/data/store.ts:16-22`: the in-memory `Store` holds merchants, payments, refunds, disputes and payouts. It has no cards. It is kept on `globalThis` so dev reloads keep writes (`:34-38`).
- `src/data/types.ts:1`: `Currency = "USD" | "EUR" | "GBP"` already matches the ticket's allowlist. The file has no card types.
- `src/data/merchants.ts:7,90`: 10 fictional merchants (`mch_01`–`mch_10`), each with a `currency` and a `timezone`. `merchantById` is the lookup to validate against.
- `src/data/queries.ts:18-36`: `parseFilters` is the house pattern for allowlisting client input in the data layer, not in the route. `paymentById` (`:108`) is the lookup pattern to copy.
- `src/lib/money.ts:15,46`: `formatMoney(minor, currency)` for display. `parseAmountToMinorUnits("250.00")` returns `25000`, or `null` for bad input. Use both and add no second formatter.
- `src/lib/dates.ts:31,22`: `formatDate` (UTC, for tables) and `formatInZone` (merchant timezone, for detail views).
- `src/components/ui/payments/StatusBadge.tsx:7-25`: label and dot maps keyed by status. Extend these rather than adding a second badge.
- `src/app/payments/page.tsx` and `src/app/payments/[id]/page.tsx`: server components that read the data layer directly and call `notFound()` on a missing id. The cards pages follow the same shape.
- `src/app/siteConfig.ts:5-10` and `src/components/ui/navigation/AppSidebar.tsx:26-47`: navigation. Cards needs an entry in both.
- `src/app/api/payments/route.ts`: the only route handlers are GETs. **No POST route and no shared error shape exist yet.** This ticket sets the shape.

**Where the docs don't match the code:**
- `merchant-console/CLAUDE.md` and the ticket say the seed is "JSON". It isn't: the data is generated in code by `src/data/generate.ts:69`, and there is no JSON file.
- `.claude/rules/components.md` lists a `Dialog` primitive. None exists. `src/components/Drawer.tsx` (built on `@radix-ui/react-dialog`) is the accessible overlay that is actually available.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`." | `CLAUDE.md` §Conventions 1 | Limits drift, and the 5,000,000 cap is checked against the wrong number |
| "Generated numbers use the `4242` test BIN and a valid Luhn check digit." | `CLAUDE.md` §Card rules | Something could resemble a real PAN |
| "Generate on the server. A card number produced in the browser is a bug." | `.claude/rules/cards.md` | The number would exist in client code paths |
| "The full number is returned exactly once, in the creation response. After that, last four only." | `CLAUDE.md` §Card rules | The PAN leaks through list and detail payloads |
| "Mask everywhere else as `•••• 4242`." | `.claude/rules/cards.md` | Inconsistent masking |
| "`active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server." | `.claude/rules/cards.md` | A cancelled card comes back via a crafted request |
| Reject a missing merchant, a limit ≤ 0, a limit > 5,000,000 minor units, or a currency outside `USD`/`EUR`/`GBP` | NWP-201 §Core | The client-side form is the only guard |
| "Storage and bucketing are UTC. Display converts to the merchant's timezone." | `CLAUDE.md` §Conventions 2 | "What happened last Tuesday" gets the wrong day |
| "Return the same error shape everywhere" | `.claude/rules/api-routes.md` | The form can't show field errors reliably |

## Approach

Card logic is split into three layers:
- **Pure domain functions** in `src/lib/cards.ts`: BIN plus Luhn generation, masking, the transition table and issue-input validation. These are unit-tested beside the file.
- **Store-touching functions** in `src/data/cards.ts`: issue, list, get by id and transition. They mirror `queries.ts`.
- **Thin route handlers** under `src/app/api/cards/` that call the data layer and return a single error shape, `{ error: { message, field? } }`, with 400 for validation, 404 for an unknown id and 409 for an illegal transition.

How the card number is handled:
- The card record stores `last4` and an id only, and never the full number.
- The POST handler returns the full number once, alongside the record.
- The issue form shows the number on a success view inside the Drawer and clears it from state when the Drawer closes.

How spend, status and history are handled:
- Spend is never stored. It is the sum of the card's charges (`cardSpend`, using `sumMinorUnits`), so a new card is at 0 and seeded cards carry the charges that make up their spend.
- A status-history array (UTC timestamp and transition) is kept on the card. It answers "what happened to this card last Tuesday".
- Freeze and unfreeze call `POST /api/cards/[id]/status`, then refresh the route, with no full page reload.

**Considered and rejected:**
- **Sending the limit as a decimal string and parsing it in the route.** The form converts once with `parseAmountToMinorUnits`, and the API accepts and validates integer minor units only. That keeps the API's money contract the same as the rest of the codebase. The server still rejects non-integers and out-of-range values, so the client is not trusted.
- **Generating card numbers inside `generate.ts`.** That would mix seed randomness with an issuing rule that must be testable on its own.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `Card`, `CardStatus`, `CardEvent`, `IssueCardInput`; `CURRENCIES` as the runtime allowlist the `Currency` type derives from |
| `src/lib/cards.ts` | add | Luhn check digit, `4242` number generator, `maskCardNumber`, transition table, `validateIssueInput` |
| `src/lib/cards.test.ts` | add | Luhn, BIN prefix, transitions, validation edges |
| `src/data/cards.ts` | add | `issueCard`, `listCards`, `cardById`, `transitionCard` against the store |
| `src/data/store.ts` | change | Add `cards` and the idempotency map (`cardRequests`) to `Store` |
| `src/data/generate.ts` | change | `generateCards()`: 5 deterministic demo cards with categories and charges (Decision 1), numbers from the same 4242 generator |
| `src/lib/api-error.ts` | add | The one error shape for route handlers: `{ error: { message, field? } }` |
| `src/app/api/cards/route.ts` | add | `GET` masked list; `POST` issue, the only response with the full number |
| `src/app/api/cards/[id]/route.ts` | add | `GET` masked detail, 404 on unknown |
| `src/app/api/cards/[id]/status/route.ts` | add | `POST { to }`, 409 on an illegal transition |
| `src/app/cards/page.tsx` | add | List: nickname, merchant, masked number, limit, status, created date, plus the empty state |
| `src/app/cards/issue-card-drawer.tsx` | add | Client form in `Drawer`; labeled inputs; field errors from the API; one-time reveal view |
| `src/app/cards/[id]/page.tsx` | add | Detail: full record, spend vs limit bar (amber > 80%), status history in merchant timezone |
| `src/app/cards/card-status-actions.tsx` | add | One status hook shared by the list-row freeze/unfreeze toggle and the detail page's freeze/unfreeze/cancel (cancel asks for confirmation) |
| `src/components/ui/payments/StatusBadge.tsx` | change | Add `active`, `frozen`, `cancelled` labels and dots |
| `src/app/siteConfig.ts`, `src/components/ui/navigation/AppSidebar.tsx`, `Breadcrumbs.tsx` | change | Cards nav entry and breadcrumb label |
| `src/components/ui/DetailField.tsx` | add | The detail-grid field, moved out of `src/app/payments/[id]/page.tsx` so both detail pages share one |

## Plan

1. **Domain functions and tests.** Done when: `npm test` passes the new `cards.test.ts`, every generated number starts with `4242`, is 16 digits and passes Luhn, `4242424242424242` validates, and each illegal transition is rejected.
2. **Types, store and data layer.** Done when: `issueCard` returns the record plus a one-time number, and `listCards`/`cardById` return records with no full number field at all.
3. **API routes.** Done when: curl `POST` with a missing merchant, a 0 limit, a 5,000,001 limit, a `JPY` currency and a non-integer limit each return 400 with `field` set; a valid `POST` returns the full number once; `GET /api/cards` and `GET /api/cards/[id]` show `•••• NNNN` only; a status change from `cancelled` returns 409.
4. **List page and nav.** Done when: `/cards` renders seeded cards (or a written empty state) and Cards appears in the sidebar.
5. **Issue Drawer.** Done when: submitting creates a card that shows in the list after close; the full number is shown once and is gone after close; validation errors land on the right field; keyboard-only use works (focus in, Escape out, focus returns).
6. **Detail page.** Done when: the full record, a spend bar that turns amber past 80% and the status history in the merchant timezone all render, and an unknown id shows 404.
7. **Freeze, unfreeze and cancel.** Done when: each action updates the badge with no full reload, and a cancelled card shows no actions.
8. **`/ship-ready`, then `/pr`.**

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Click through the Drawer on `/cards`; the new row appears |
| Card list | `/cards` shows all six fields; `GET /api/cards` payload has no full number |
| Card detail | `/cards/[id]` shows the record and spend vs limit |
| Generated numbers | `cards.test.ts`: `4242` prefix, length, Luhn over many generated numbers |
| Reveal once, mask forever | `POST` response contains the number; `GET` list and detail responses (curl) contain only the masked form; reopening the Drawer shows nothing |
| Server-side validation | Five curl cases from Plan step 3, plus `validateIssueInput` unit tests |
| Stretch: freeze/unfreeze, spend bar, tests, empty/error states | Steps 6–7 clicks, and `cards.test.ts` transition tests |

## Risks

- **The reveal leaks through client state.** Hold the number only in the Drawer's local state, and clear it on close.
- **A double-click on Issue creates two cards.** The submit button disables while a request is pending. The server also dedupes on an idempotency key (Decision 3).
- **`sortPayments` sorts amounts as strings** (`src/data/queries.ts:81`). This is not our bug; don't touch it in this PR. Flag it instead.

## Out of scope

- Persistence (NWP-203), auth/roles, real card-network calls, and editing a limit after issue (NWP-202), all per the ticket.
- Enforcing the category lock against real transactions: there is no card network here, so the lock is chosen, validated, stored, and shown.

## Decisions (answered by Patrick, 2026-11-03)

1. **Spend on cards.** Seed 5 demo cards at boot with varied spend, one past 80%. New cards start at 0 spent.
2. **Currency vs merchant.** The form defaults to the merchant's currency, and any of `USD`/`EUR`/`GBP` is accepted.
3. **Duplicate submits.** The form sends an idempotency key. The server returns the original card for a repeated key and never issues a second one.
4. **Cancel in the UI.** Exposed behind a confirm. A cancelled card shows no actions.
5. **Nickname.** Required, trimmed, 1–60 characters.

## Changes after the first review (2026-11-03)

- **Decision 1 revised.** Seeded spend is the sum of seeded charges, not a hardcoded total. The detail page lists the charges.
- **Decision 2 revised.** The server rejects a card currency that differs from the merchant's (`validateIssueInput`). The form still defaults to it.
- **Freeze and unfreeze from the list.** Each list row has a freeze/unfreeze toggle, as the ticket asks, as well as the detail page.
- **Merchant category lock built.** The category is chosen at issue from an allowlist (`CARD_CATEGORIES`), validated on the server, and shown in the list and on the detail page.
