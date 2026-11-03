# SPEC · NWP-101 — Payments export options

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** amylin
**Status:** done

## Problem

Ops exports payments several times a day, but every file carries every column, including the card last four. Anything going to a merchant has to be cleaned by hand first, which costs Dana's team 3–4 hours a month, and an unedited file nearly went to the wrong merchant last quarter.

## Current state

- `build-battle/merchant-console/src/app/payments/page.tsx` — Export is a plain link to `/api/payments/export` with the page's query string. The page builds its own `PaymentFilters` instead of calling `parseFilters`.
- `build-battle/merchant-console/src/app/api/payments/export/route.ts` — `parseFilters` → `filterPayments` → `sortPayments` → `toCsv(rows)` with every column; `exportFilename()` has no scope. It skips `paginate`, so the file already holds every matching row.
- `build-battle/merchant-console/src/lib/csv.ts` — `EXPORT_COLUMNS` (10 columns, including `last4`); `toCsv(payments, columns)` already writes any subset in the given order.
- `build-battle/merchant-console/src/data/queries.ts` — the one query builder: `parseFilters`, `filterPayments`, `sortPayments`, `paginate`, `queryPayments`.
- `.claude/rules/components.md` lists a `Dialog` component, but there is none. `src/components/Drawer.tsx` is a Radix Dialog and is used instead.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Validate column names server-side; do not interpolate them | NWP-101 notes; `CLAUDE.md` convention 4 | Arbitrary strings reach the cell lookup or the filename |
| Build the export on the server, not in the browser | NWP-101 notes | Only the visible 20-row page is exported |
| Reuse the query builder behind `GET /api/payments` | NWP-101 notes; `CLAUDE.md` convention 3 | Table and file disagree on what matches |
| Money is integer minor units, formatted once at the edge | `CLAUDE.md` convention 1 | Rounding drift, mixed formats |
| Same error shape everywhere | `.claude/rules/api-routes.md` | Clients cannot show a useful message |

## Approach

The browser builds a URL (`scope`, `columns` and the table's filters), and the route validates every parameter against allowlists before anything else happens. Column parsing is a pure function in `src/lib/csv.ts`, so it can be unit tested. Rows still come from `filterPayments` and `sortPayments`; `scope=all` passes empty filters through the same builder. The payments page now uses `parseFilters` too, so the count shown in the dialog equals the rows in the file.

**Considered and rejected:** generating the CSV client-side from the table rows. It exports only the current page, the bug the ticket warns about, and it would need the full card data in the browser.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | change | `DEFAULT_EXPORT_COLUMNS`, `parseExportColumns`, scope in `exportFilename` |
| `src/app/api/payments/export/route.ts` | change | Validate `scope` and `columns`, return 400 `{ error }`, scoped filename |
| `src/app/payments/page.tsx` | change | Use `parseFilters`; pass counts to the dialog |
| `src/app/payments/export-dialog.tsx` | add | Options dialog on the existing Drawer |
| `src/lib/csv.test.ts` | change | Column selection and filename tests |

## Plan

1. **Column selection in `csv.ts`** — done when: `parseExportColumns` returns the defaults, a subset in order, `[]`, or `null`.
2. **Route validation** — done when: bad `scope` or `columns` return 400 with a message; good requests return a scoped filename.
3. **Page uses `parseFilters` and passes counts** — done when: the dialog's current-filter count equals the table footer.
4. **Export dialog** — done when: last four starts unchecked, scope switches the count, and Download is disabled with no columns.
5. **Tests** — done when: `npm test` passes with the new cases.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Choose columns; last four off by default | `csv.test.ts` "leaves out the card last four…"; in the browser the box is unchecked and the default file header has no `last4` |
| Scope: current filter (default) or all; row count visible | Dialog shows 33 for `status=disputed` (matching the footer) and 1,658 for all; files had 33 and 1,658 rows |
| Filename reflects scope and date | `csv.test.ts` "names the scope before the date"; route returned `payments-disputed-2026-11-03.csv` and `payments-all-2026-11-03.csv` |
| Amounts in minor units, formatted once, currency in its own column | Unchanged `toCsv` path: `formatMoney` at serialization, separate `currency` column; existing tests still pass |
| No columns → Download disabled | Browser: unchecking every box disables Download; the route also returns 400 for `columns=` |

## Risks

- `sortPayments` compares amounts as text (`src/data/queries.ts`), so `sort=amount` orders wrong. The UI never sends it; this is left for a separate fix.
- The amount cell keeps the currency symbol (`$250.00`), as existing tests require. If finance wants plain decimals, that is a change to `toCsv`, not to this dialog.
