# SPEC · NWP-101 — Payments export: columns and scope

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Adam Raabe
**Status:** draft

## Problem

Dana Whitfield's ops team exports the payments table several times a day, for merchant
queries, month-end reconciliation, and whatever Finance asks for. The file is fixed: every
column, current filter only. Because the card last-four is in every file, anything going to a
merchant gets cleaned up by hand first — 3–4 hours a month, and a near-miss last quarter
where an unedited file nearly went to the wrong merchant.

## Current state

- `build-battle/merchant-console/src/lib/csv.ts` — `toCsv(payments, columns)` **already takes a
  column list**, defaulting to `EXPORT_COLUMNS`; `ExportColumn` is already the union of the ten
  valid names. `cell()` formats `amount` through `formatMoney` and emits `currency` separately.
  `exportFilename(date = new Date())` takes a date and no scope.
- `build-battle/merchant-console/src/app/api/payments/export/route.ts` — 25 lines. Calls
  `parseFilters`, `filterPayments`, `sortPayments`, then `toCsv(rows)` with no column argument
  and `exportFilename()` with no arguments. Its own comment names NWP-101.
- `build-battle/merchant-console/src/data/queries.ts` — the one query builder. `parseFilters`
  allowlists `status`, `sort` and `direction` but does **not** read `columns` or `scope`.
  `filterPayments` and `sortPayments` are exported separately from `queryPayments`, so the export
  route already skips pagination correctly.
- `build-battle/merchant-console/src/app/payments/page.tsx:71` — Export is a plain
  `<a href="/api/payments/export?…">` wrapped in a secondary `Button`. The page already has
  `total` (the current-filter row count) back from `queryPayments` at line 46.
- `build-battle/merchant-console/src/lib/csv.test.ts` — 9 tests pinning escaping, the header
  contract, merchant fallback, empty card cells, and `exportFilename`. Baseline measured before
  any edit: `npm test` is green, 28 tests across `csv`, `money` and `dates` (vitest 3.2.7,
  node 24.22.1). Its header comment states NWP-101 changes which columns ship, not how a cell
  is written.
- `build-battle/merchant-console/src/components/Drawer.tsx` — Radix-dialog-based, exports
  `Drawer`, `DrawerTrigger`, `DrawerContent`, `DrawerHeader`, `DrawerTitle`, `DrawerDescription`,
  `DrawerBody`, `DrawerFooter`, `DrawerClose`. This is the only dialog shell in the repo.

**Where the ticket and the docs disagree with the code:**

- `.claude/rules/components.md` says `src/components/` "already has Button, Input, Select,
  Dialog". There is **no** `Dialog.tsx` — only `Drawer.tsx`. `@radix-ui/react-dialog@^1.1.15` is a
  dependency, so the shell exists, but the rule names a file that does not.
- There is **no Checkbox or Label primitive** anywhere in `src/components/`, and no
  `@radix-ui/react-checkbox` dependency. The column picker has to use native inputs styled with
  Tailwind.
- The ticket says "Amounts stay in minor units internally and are formatted once on the way out."
  `csv.ts` already does exactly this. That criterion is satisfied by not breaking it.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Anything from the client — column names, currencies, limits, statuses — is checked against an allowlist before it reaches a query, a filename, or the store. Client-side checks are UX, never enforcement." | `ORG-STANDARDS.md` #7, `.claude/rules/api-routes.md` | Column names reach a filename or a query unchecked |
| "One query builder. Payment filtering goes through the builder behind `GET /api/payments`. A second implementation is a bug, not a shortcut." | `merchant-console/CLAUDE.md` #3, `ORG-STANDARDS.md` #6 | A second filter path drifts from the table |
| "Money is integer minor units… Format once, at the edge, next to its currency code." | `merchant-console/CLAUDE.md` #1, `ORG-STANDARDS.md` #1–2 | Cents drift; a formatted amount re-enters arithmetic |
| "Storage and bucketing are UTC." | `merchant-console/CLAUDE.md` #2, `ORG-STANDARDS.md` #4 | The filename date disagrees with the rows |
| "Card numbers are masked everywhere except the single creation response." | `ORG-STANDARDS.md` #8 | `last4` defaulting on is the near-miss repeating |
| "Match the neighborhood." | `ORG-STANDARDS.md` #9 | A hand-rolled modal next to `Drawer.tsx` |
| The export "is paginated. Building this in the browser exports the current page only" | ticket, Notes from the team | Shipping the bug instead of the feature |

## Approach

Keep the server as the single source of the file. The export stays one `GET` on the existing
route; the dialog only composes its query string. `parseFilters` gains nothing — instead the
export route parses two extra params of its own against allowlists: `columns` (each name checked
against `EXPORT_COLUMNS`) and `scope` (`filter` | `all`). `scope=all` means calling the same
`filterPayments` with an empty filter object rather than a second code path. `csv.ts` gains a
scope-aware filename and a `DEFAULT_EXPORT_COLUMNS` list that is `EXPORT_COLUMNS` minus `last4`.
The dialog is a client component built on `Drawer`, receiving both row counts as props from the
server page, so nothing is counted in the browser and no new endpoint appears.

**Considered and rejected:** a `POST` that returns the file, so the column list travels as JSON
rather than a long query string. Rejected because a plain `<a>` download is what the page does
today and a `POST` would need a fetch, a blob, and a synthetic click — more moving parts for a
file the browser can already fetch. Also rejected: a `/api/payments/count` endpoint for the
scope row counts, because `page.tsx` already has the filtered `total` and the unfiltered count is
one more `filterPayments` call in the server component.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | change | Add `DEFAULT_EXPORT_COLUMNS` (no `last4`), a column-name validator, and a scope argument on `exportFilename` |
| `src/lib/csv.test.ts` | change | Extend, per the ticket's definition of done. Cover the default column set, the validator, and the scoped filename |
| `src/app/api/payments/export/route.ts` | change | Parse and allowlist `columns` and `scope`; pass both through; 400 on no valid columns |
| `src/app/payments/export-dialog.tsx` | add | Client component: column checkboxes, scope radio, row counts, Download disabled when nothing is selected |
| `src/app/payments/page.tsx` | change | Replace the bare Export anchor with the dialog trigger; pass the filtered and total counts and the current query string |

## Plan

0. ~~**Establish the baseline**~~ — **done.** `npm install` (499 packages) and `npm test` green at
   28 passed, before any edit.
1. **`csv.ts`: default columns, validator, scoped filename** — done when: `npm test` still passes
   all 9 existing tests, including `exportFilename(new Date(...))` called positionally.
2. **Extend `csv.test.ts`** — done when: new tests cover `last4` absent from the default set, an
   unknown column name rejected, a `last4` request honoured when explicitly asked for, and
   `payments-disputed-2026-08-13.csv` for scoped output. `npm test` green.
3. **Export route: allowlist and scope** — done when: `curl` of
   `/api/payments/export?status=disputed` returns a file with no `last4` column and a
   `payments-disputed-…csv` filename; `?columns=id,nonsense` returns 400; `?scope=all&status=disputed`
   returns every payment.
4. **The dialog** — done when: clicking Export on `/payments` opens a named dialog, Escape closes
   it, focus returns to the trigger, both row counts show, and Download greys out with nothing ticked.
5. **Wire the page** — done when: a disputed-filter export downloads a file matching the visible
   count, and switching to "all payments" downloads more rows than the page shows.
6. **`/ship-ready`, then `npm test` and `npm run lint`** — done when: all clean.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops can choose columns; last-four **off** by default | New `csv.test.ts` case asserting `last4` is not in `DEFAULT_EXPORT_COLUMNS`; the checkbox unticked on open |
| Scope current-filter (default) or all, count visible before download | Click-through on `/payments?status=disputed`: the dialog's filtered count matches the table's `total`; the all count is larger |
| Filename reflects scope and date | New `exportFilename` test for `payments-disputed-2026-08-13.csv` and `payments-all-…`; confirmed in the browser's download |
| Amounts in minor units, formatted once, currency its own column | Existing `toCsv` amount tests keep passing; no new formatter added |
| Deselecting every column disables Download | Dialog click-through; plus a 400 from the route when `columns` resolves to nothing, because client checks are UX only |
| Unit test covers the column serializer, `npm test` passes | `cd build-battle/merchant-console && npm test` |

## Risks

- `exportFilename` is already under test called positionally with a date. Adding scope as the
  **first** parameter breaks that test. Add it second, or as an options object after the date.
- An `<a>` download cannot read a JSON error, so a 400 from the route shows the user nothing. The
  disabled Download button is the real guard; the 400 exists for the standard, not the UX.
- `sortPayments` in `queries.ts:84` sorts amounts as strings (`String(a.amount).localeCompare`),
  so `$90.00` orders above `$1,000.00`. It affects export row order. It is **not** this ticket —
  it looks like NWP-102 — and must be left alone rather than fixed in passing.
- No Checkbox primitive exists, so the picker is native inputs. Each needs a real label, per
  `.claude/rules/components.md`.

## Out of scope

- Reordering columns. Not asked for.
- Saving a column preset per user. **Revised after the first build:** ops asked for the
  choice to stick, so the dialog remembers the column set and format in `sessionStorage`
  for the browser session only. That is a UI convenience, not the persistence NWP-203
  covers: nothing reaches the store, and a blocked store falls back to the defaults.
- Formats other than CSV.
- Fixing the amount sort bug — NWP-102.
- Date-range filters in the dialog. `parseFilters` reads `from`/`to` but `filter-bar.tsx` never
  sets them, so the UI for them is a separate ticket.

## Open questions

- **What is the scope token in the filename when the filter is not a status?** The ticket's only
  example is `payments-disputed-…`. Recommendation: status when one is set, else `filtered` when
  any other filter (merchant, search) is active, else `all` — and `all` whenever `scope=all`,
  regardless of filters.
- **Does "all payments" ignore every filter, or keep the merchant filter?** Reading it plainly:
  every filter. Recommendation: ignore all of them, and label the radio "All payments (ignores
  filters)" so nobody is surprised by the count.
