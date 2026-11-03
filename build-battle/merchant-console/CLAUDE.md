# Northwind Payments — Merchant Console

The internal tool support and ops staff use to look up a payment, refund it, work the dispute queue, and issue virtual cards.

Northwind Payments is fictional. Every merchant, cardholder, amount, and card in this app is generated.

## Run it

```bash
npm install
npm run dev                                       # http://localhost:3000, redirects to /overview
npm test                                          # Vitest, Node environment, src/**/*.test.ts only
npx vitest run src/lib/csv.test.ts -t "quotes"    # one file, one test by name
npm run lint
npx tsc --noEmit                                  # type check; there is no script for it
```

No database, no seed step, no Docker. Run every command from this folder: the repository root has no `package.json`.

## Data lives in memory

Seed data is generated at boot by `src/data/generate.ts` from a fixed seed, so every machine sees identical records. The store in `src/data/store.ts` holds it on `globalThis`, so dev-server hot reloads do not reset it. Pages and route handlers read and write that store.

- Writes last for the life of the dev server and vanish on restart. That is expected.
- Persistence is tracked separately as NWP-203. **Do not add a database, an ORM, or migrations.**
- If you need more seed data, change the generator. Never change it to make a failing case disappear.

## Where the rest of the context lives

This file loads every session, so it stays short. Detail that only matters once you open a particular kind of file lives in `.claude/rules/` and loads when you do:

| Rule | Applies to |
| --- | --- |
| `money.md` | `src/lib/`, `src/app/api/`, `src/data/` |
| `api-routes.md` | `src/app/api/` |
| `cards.md` | anything card-related |
| `components.md` | `src/components/`, `src/app/` |

## Conventions

These four explain most of the code, and breaking them is how bugs get in here.

1. **Money is integer minor units.** `$250.00` is `25000`. No floats, no strings with currency symbols. Format once, at the edge, next to its currency code.
2. **Storage and bucketing are UTC.** Display converts to the merchant's timezone. Nothing else does.
3. **One query builder.** Payment filtering goes through the builder behind `GET /api/payments`. A second implementation is a bug, not a shortcut.
4. **Validate on the server.** Anything from the client — column names, currencies, limits, statuses — is checked against an allowlist before it reaches a query, a filename, or the store.

## Card rules

- Generated numbers use the `4242` test BIN and a valid Luhn check digit. Nothing here may resemble a real PAN.
- The full number is returned exactly once, in the creation response. After that, last four only.
- Status is a state machine: `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal.

## Layout

| Path | What lives there |
| --- | --- |
| `src/app/` | Console routes: overview, payments, disputes, payouts. Cards is NWP-201 and does not exist yet |
| `src/app/api/` | Route handlers |
| `src/data/` | Seed JSON, the in-memory store, and types |
| `src/components/` | Tremor-based primitives and the console's own components |
| `src/lib/` | Money, date, and CSV helpers, each with a `.test.ts` beside it. Read these before touching an amount |

`@/` maps to `src/`.

## How requests flow

- Pages are Server Components that call `src/data/queries.ts` directly; they do not fetch the API. The only HTTP routes are `GET /api/payments` (one page as JSON) and `GET /api/payments/export` (CSV).
- `parseFilters` is where client input meets the allowlists. `queryPayments` filters, sorts, and paginates in one call.
- The export calls `filterPayments` and `sortPayments` and skips pagination on purpose, so it covers every matching row, not the visible page.

## Before you push

Run `npm test`, then `/ship-ready`. The skill checks the rules above, not just formatting.
