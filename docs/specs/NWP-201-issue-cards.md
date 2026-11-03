# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** anthonyrizo83, with Claude Code
**Status:** done

## Problem

Ops issues virtual cards by messaging the platform team, 12–20 times a week, and waits hours each time. Last month two cards went out with the wrong spend limit because the request lived in a Slack thread. Ops needs to issue a card, see what they've issued, and check one, all in the console.

## Current state

Paths are relative to `build-battle/merchant-console/`.

- **No cards exist anywhere.** No `Card` type in `src/data/types.ts`, nothing in `src/data/store.ts`, no route under `src/app/` or `src/app/api/`.
- `src/data/store.ts:29` — `createStore()` builds the in-memory store from `generate()` and keeps it on `globalThis`. Cards get added here.
- `src/data/generate.ts:20` — **one shared PRNG** (`mulberry32(SEED)`) drives every payment, refund and dispute. Any new `rand()` call made before payments are generated shifts all existing data.
- `src/data/merchants.ts` — 8 merchants, each with a settlement `currency` (USD, GBP for `mch_04`, EUR for `mch_05`/`mch_06`) and an IANA `timezone`.
- `src/lib/money.ts:44` — `parseAmountToMinorUnits("250.00")` → `25000`, `null` on bad input. This is the boundary parser for the limit. `formatMoney` formats amounts for display.
- `src/lib/dates.ts:22` — `formatInZone()` for merchant-local display. `formatDate()` for UTC table dates.
- `src/components/ui/payments/StatusBadge.tsx` — the shared status badge. Card statuses get added to it rather than built separately.
- `src/app/payments/[id]/page.tsx` — the detail page pattern: back link, header, `Field` grid, and a timeline shown in the merchant's timezone.
- `src/components/Drawer.tsx` — the Radix Dialog primitive. There is no `Dialog` component, despite `.claude/rules/components.md`.
- Navigation: `src/app/siteConfig.ts` (`baseLinks`), `src/components/ui/navigation/AppSidebar.tsx`, `Breadcrumbs.tsx` (`LABELS`).
- **Ticket vs code:** the ticket says the store is "seeded from JSON". It's generated in code by `generate.ts`.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "A `$250.00` limit is `25000`. Never a float, never a string with a dollar sign." | Ticket rule 1, `CLAUDE.md` #1 | Limits drift; spend comparisons go wrong |
| "Store the last four and the generated number's reference. The reveal is a one-time response, not a field you can re-read." | Ticket rule 2, ORG-STANDARDS #8 | A full number leaks through a list, detail or client state |
| "`active → frozen → active`, and either can go to `cancelled`. `cancelled` is terminal." Guard it "on the server, not only in the UI". | Ticket rule 3, `.claude/rules/cards.md` | A cancelled card comes back to life |
| "Every generated number starts `4242` and carries a valid Luhn check digit." Generated on the server. | Ticket rule 4, `cards.md` | Something resembling a real card number |
| Reject a missing merchant, a limit ≤ 0, a limit > 5,000,000 minor units, and a currency outside `USD`, `EUR`, `GBP` | Ticket core criteria, ORG-STANDARDS #7 | Bad cards issued by a crafted request |
| Display converts to the merchant's timezone; storage is UTC | `CLAUDE.md` #2 | "What happened last Tuesday" answered with the wrong day |

## Approach

Add a `Card` record to the in-memory store. It holds `last4`, an opaque `panReference`, the limit in minor units with its currency, `spent`, `status`, an optional category, and an **event history** (issued, frozen, unfrozen, cancelled, each with a UTC timestamp). That history answers "what happened to this card last Tuesday".
- **Endpoints:** `POST /api/cards` issues a card, and `PATCH /api/cards/[id]` changes its status. Pages read the store directly, like every other page here.
- **Pure logic:** Luhn, masking, validation and transitions live in `src/lib/cards.ts` with tests beside them. Store operations live in `src/data/cards.ts`.
- **Reveal once:** the full number exists only in the `POST` response. The success screen shows it once and clears it from client state on close.
- **Double clicks:** the submit button disables while a request is in flight. Each issue form also sends an `Idempotency-Key`, and a repeated key returns the card already created, masked and **without** the number again, so a double click can't issue two cards or reveal twice.
- **Currency:** it defaults to the merchant's settlement currency, and choosing a different one shows a warning (decided with the user).

**Considered and rejected:** generating the number in a server component or route and passing it to the page as props. It would end up in the page's server render payload and client cache, which breaks reveal-once. **Also rejected:** seeding cards with `rand()`, because it would shift every existing payment. The seed cards are fixed records instead.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | Change | `Card`, `CardStatus`, `CardEvent`, `CardCategory` |
| `src/lib/cards.ts` | Add | Luhn check digit, 4242 generator, masking, `canTransition`, issue-input validation, allowlists |
| `src/lib/cards.test.ts` | Add | Luhn, BIN, masking, transitions, validation boundaries |
| `src/data/cards.ts` | Add | `listCards`, `cardById`, `issueCard`, `setCardStatus`, idempotency lookup |
| `src/data/store.ts` | Change | `cards` and the idempotency map on the store |
| `src/data/generate.ts` | Change | 4 fixed seed cards (one frozen, one cancelled, one past 80% spend), no PRNG use |
| `src/app/api/cards/route.ts` | Add | `POST`: validate, issue, return the masked card plus the number once. 400 `{ error }` on bad input |
| `src/app/api/cards/[id]/route.ts` | Add | `PATCH` status: 404 unknown card, 400 bad status, 409 transition not allowed |
| `src/app/cards/page.tsx` | Add | List with the empty state and the Issue button |
| `src/app/cards/issue-card-dialog.tsx` | Add | Drawer form, then a one-time success screen |
| `src/app/cards/card-status-actions.tsx` | Add | Freeze, unfreeze and cancel (with an inline confirm), followed by `router.refresh()` rather than a full reload |
| `src/app/cards/[id]/page.tsx` | Add | Detail: fields, spend bar (amber past 80%), history in the merchant's timezone |
| `src/components/ui/payments/StatusBadge.tsx` | Change | `active`, `frozen`, `cancelled` |
| `siteConfig.ts`, `AppSidebar.tsx`, `Breadcrumbs.tsx` | Change | Cards in the navigation |

## Plan

1. **Types and `src/lib/cards.ts` with tests** — done when: `npm test` passes the Luhn, BIN, mask, transition and validation cases.
2. **Store, data operations and seed cards** — done when: existing tests still pass and the overview totals are unchanged (payments unaffected).
3. **API routes** — done when: curl shows 201 with the number once, 400 for each invalid input, and 409 for an un-cancel.
4. **List page and navigation** — done when: `/cards` lists the seed cards masked, and the empty state renders with no cards.
5. **Issue dialog** — done when: issuing shows the number once, closing returns to the list with the new card masked, and a double click creates one card.
6. **Detail page** — done when: fields, the spend bar and history show, with timestamps in the merchant's timezone.
7. **Status actions** — done when: freeze and unfreeze update without a full reload, cancel asks to confirm, and a cancelled card has no actions.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Browser: fill in the form, submit, the success screen appears, then the card shows in the list. curl `POST /api/cards` → 201 |
| Card list | Browser `/cards`: nickname, merchant, `•••• 1234`, limit, status, created date |
| Card detail | Browser `/cards/<id>`: full record, spend against limit |
| Generated numbers | `cards.test.ts`: 1,000 generated numbers all start `4242`, are 16 digits, and pass Luhn. Known valid number `4242424242424242` |
| Reveal once, mask forever | curl: only the `POST` body has `number`. List and detail HTML contain no 16-digit run. A repeated idempotency key gets no `number`. Closing the success screen clears it |
| Server-side validation | curl and tests: no merchant, `0`, `-5`, `50000.01` (above 5,000,000 minor units), `JPY` → 400. `50000.00` → 201 |
| Stretch: freeze/unfreeze | Browser: the status changes in place, network shows `PATCH` with no document reload |
| Stretch: spend progress | Seeded card at more than 80% → amber bar |
| Stretch: category lock | Chosen in the form, allowlisted on the server, shown in the list and detail |
| Stretch: tests | `npm test` summary |
| Stretch: empty and error states | Empty list copy. API errors shown inline in the form |

## Risks

- **The full number leaking.** Number generation stays in the `POST` handler path only, the number is never stored, and `src/data/cards.test.ts` checks that the stored card has no `number` field and doesn't contain the number anywhere.
- **A retry after an edit bringing back the old card.** If the network drops after a card is created, ops might change the limit and resubmit from the same form. Reusing the idempotency key with different details returns 409 instead of the earlier card. *(Found in an independent review.)*
- **Seed cards shifting payment data.** They're fixed literals added after `generate()` runs. I'll check that overview totals are unchanged.
- **Freeze racing a cancel from another tab.** The server checks the transition against current state and returns 409. The UI shows the message and refreshes.

## Out of scope

- Editing a limit after issue (NWP-202), persistence (NWP-203), auth and roles, and real card network calls.
- Ingesting real spend. `spent` is seeded for demo cards and starts at 0 for new ones.

## Open questions

- None blocking. Confirmed with the user: default the currency to the merchant's and warn on a mismatch, and seed demo cards.
