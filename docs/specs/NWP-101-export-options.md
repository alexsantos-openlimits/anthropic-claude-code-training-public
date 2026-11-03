# SPEC · NWP-101 — Payments export options

> Written before any code. Planned with Superpowers `writing-plans`, design- and readiness-reviewed by two EGM goldfish subagents, then edited.
> Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** gsVAM
**Status:** reviewed
**Branch:** `NWP-101-export-options` · paths below are relative to `build-battle/merchant-console/`

## Problem

Ops exports payments several times a day, and every file carries every column, card last-four included. Anything sent to a merchant gets cleaned by hand, which costs 3–4 hours a month. Last quarter an unedited file nearly went to the wrong merchant.

## Current state

- `src/app/payments/page.tsx:68-76`: Export is a plain `<a href="/api/payments/export?{query}">` with the page's search params. It sends no `columns`.
- `src/app/payments/page.tsx:36-43`: the page builds its filters by hand instead of calling `parseFilters`. It ignores `from`, `to`, `sort` and `direction`, so its count can differ from what the export returns.
- `src/app/api/payments/export/route.ts:11-24`: `parseFilters` → `filterPayments` → `sortPayments` → `toCsv` → `exportFilename()`. It never calls `paginate`, so the export already covers every matching row.
- `src/data/queries.ts:18-36`: `parseFilters` allowlists status, sort and direction. `merchantId`, `search`, `from` and `to` pass through unvalidated.
- `src/lib/csv.ts:13-24`: `EXPORT_COLUMNS` lists 10 columns, `last4` included. `toCsv(payments, columns)` already takes a subset (`:58`). `exportFilename(date)` returns `payments-YYYY-MM-DD.csv` in UTC (`:69`).
- `src/lib/csv.test.ts`: 9 tests. Its header comment (`:5-9`) says NWP-101 "changes which columns ship, not how a cell is written". `:34` pins `$250.00`.
- `src/components/Drawer.tsx:3`: a side panel built on Radix Dialog. There is **no** `Dialog.tsx` and no checkbox component, although `.claude/rules/components.md:9` lists a Dialog.
- `src/components/Button.tsx:117,122`: with `asChild`, `disabled` lands on the child. On an `<a>` it does nothing. `page.tsx:145-146` shows the working pattern: a real disabled button with a `<span>` inside.
- No route returns an error body yet, so this ticket defines the first one.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Validate on the server… column names… checked against an allowlist before it reaches a query, a filename, or the store." | `CLAUDE.md`, `.claude/rules/api-routes.md` | Arbitrary input reaches the filename or serializer |
| "One query builder… A second implementation is a bug, not a shortcut." | `CLAUDE.md` | Count and file disagree |
| "Return the same error shape everywhere… a body with a message safe to show a user." | `.claude/rules/api-routes.md:11` | Every route invents its own shape |
| "Building this in the browser exports the current page only." | ticket notes | A 20-row export ships |
| "Every input has a label, the dialog has an accessible name, focus moves into it and returns on close, Escape closes it." | `.claude/rules/components.md:11` | Inaccessible dialog |
| "A float, a rounded intermediate, or a string with a currency symbol in stored data is a violation" | `docs/ORG-STANDARDS.md` #1 | (The CSV is output, not storage, so `$250.00` stays.) |

## Approach

The browser only picks options and follows a link. All logic stays on the server, behind `parseFilters` and `filterPayments`.

**Decisions:**
- **Scope is a link choice, not a parameter.** "Current filter" sends the page's filters. "All payments" sends none.
- **Columns parameter.** A missing `columns` means the default set (everything but `last4`), so old links stop leaking card digits. Present means comma-separated names. An empty item, an unknown name or a duplicate gets a 400 with body `{ "error": "<message>" }`. Request order is kept.
- **Filename label.** Built only from allowlisted values (rules in Task 1). Search text never reaches a filename.
- **UI.** The options open in the existing `Drawer`, with native labelled checkboxes and radio buttons. Both counts are server-rendered props, so there's no extra request.

**Considered and rejected:**
- **Building the CSV in the browser.** It would export one page only.
- **A `scope` query parameter.** It needs another allowlist and another 400 path, for what a link without filters already does (`queries.ts:25-27,49-69`).
- **A new `Dialog.tsx`.** The Drawer is already a Radix Dialog with focus trap and Escape handling.

## Review focus

1. Old or bookmarked links with no `columns` must not include `last4` (Task 1 test, Task 2 curl).
2. `columns=id,,amount`, `columns=`, `columns=id,id` and `columns=id,password` all return 400 (Task 1 tests, Task 2 curl).
3. Search text like `../x,"y` never appears in a filename (Task 1 test).
4. An unknown `merchantId` becomes `filtered` in the label rather than being echoed (Task 1 test).
5. A filter matching nothing still downloads a header-only file, and the count shows 0 (existing `toCsv` test, Task 3 browser check).

## Plan

**Task 1 · `src/lib/csv.ts` + `src/lib/csv.test.ts`** (tests first)
- **Add `DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[]`.** It is `EXPORT_COLUMNS` without `last4`. Test: it does not contain `last4`.
- **Add `parseExportColumns(raw: string | null): ExportColumn[] | null`.** `null` means invalid. Tests:
  - `null` returns `DEFAULT_EXPORT_COLUMNS`
  - `"amount,id"` returns `["amount","id"]`
  - `""`, `"id,,amount"`, `"id,id"` and `"id,password"` each return `null`
- **Add `exportLabel(filters: PaymentFilters): string`.** It joins three optional parts with `-`:
  - the status, unless it is `all`
  - the `merchantId`, only if `merchantById` resolves it
  - `filtered`, if `search`, `from` or `to` is set, or the `merchantId` does not resolve

  Empty gives `all`. Tests:
  - `{}` gives `all`
  - `{status:"disputed"}` gives `disputed`
  - `{status:"disputed", merchantId:"mch_03"}` gives `disputed-mch_03`
  - `{merchantId:"mch_missing"}` gives `filtered`
  - `{search:'../x,"y'}` gives `filtered`
- **Change `exportFilename(date = new Date(), label?: string)`.** With a label it returns `payments-<label>-<YYYY-MM-DD>.csv`. Without one, today's output is unchanged. Test: `exportFilename(new Date("2026-08-13T12:00:00Z"), "disputed")` gives `payments-disputed-2026-08-13.csv`. The existing 9 tests must still pass unedited.
- **Done when:** `npx vitest run src/lib/csv.test.ts` is green. Commit: `NWP-101: export column defaults, validation and filename label`.

**Task 2 · `src/app/api/payments/export/route.ts`**
- **Change:** read `columns` with `parseExportColumns`. If it returns `null`, respond 400 with `{ error: "Choose at least one valid column." }` and stop. Otherwise call `toCsv(rows, columns)` and `exportFilename(new Date(), exportLabel(filters))`.
- **Done when** these curl checks against `npm run dev` pass:
  - No `columns`: the header has no `last4`.
  - `columns=id,amount`: header `id,amount`.
  - `columns=`, `columns=id,password` and `columns=id,id`: 400 with that JSON body.
  - `status=disputed`: the line count is `total` + 1, using `total` from `/api/payments?status=disputed`. `content-disposition` names `payments-disputed-<today UTC>.csv`.
- **Commit:** `NWP-101: validate export columns server-side`.

**Task 3 · `src/app/payments/page.tsx` + new `src/app/payments/export-dialog.tsx`**
- **Page:** build `query` first, then `filters = parseFilters(query)`. Compute `allCount = filterPayments({ status: "all" }).length`. Render `<ExportDialog filterQuery={…} filteredCount={total} allCount={allCount} />` in place of the link, dropping `page` from `filterQuery`.
- **`ExportDialog`** (client component):
  - It uses `Drawer`, `DrawerTitle` "Export payments" and `DrawerDescription`.
  - One labelled checkbox per `EXPORT_COLUMNS` entry, ticked from `DEFAULT_EXPORT_COLUMNS`. Labels: ID, Created (UTC), Merchant, Description, Status, Method, Card brand, Card last four, Amount, Currency.
  - A radio group with "Current filter (N payments)" selected by default and "All payments (N payments)".
  - Download is a `Button asChild` link to `/api/payments/export?<filters if current>&columns=<ticked, in EXPORT_COLUMNS order>`. The URL comes from a new pure `exportHref(filterQuery, scope, columns)` in `src/lib/csv.ts`, unit-tested in `csv.test.ts`, which also drops `page`.
  - With nothing ticked, Download becomes a real disabled button with a `<span>` inside, as at `page.tsx:145-146`.
- **Done when** these browser checks pass:
  - Last four starts unticked, and both counts show.
  - Unticking every column disables Download.
  - The downloaded file matches the ticked columns and the chosen scope.
  - Tab moves through the controls, Escape closes, and focus returns to Export.
  - Editing `from`/`to` by hand in the URL changes the count. (The filter bar drops these, `filter-bar.tsx:35-41`.)
- **Commit:** `NWP-101: export options dialog on /payments`.

**Task 4 · Ship**
- `npm test`, `npx tsc --noEmit` and `npm run lint` are clean. `/ship-ready` passes.
- Push `NWP-101-export-options`. The PR description says what changed and how it was verified, including the separate CLAUDE.md commit.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Choose columns; last four off by default | Task 1 default tests; Task 2 no-`columns` curl; Task 3 browser |
| Choose scope; current filter default; count visible | Task 3 browser; Task 2 count equals `total`; "All" count equals `total` from `/api/payments` with no params |
| Filename reflects scope and date | Task 1 label and filename tests; Task 2 `content-disposition` |
| Minor units inside, formatted once, currency in its own column | Unchanged `toCsv` tests (`csv.test.ts:34-40`); `formatMoney` called only in `cell()` |
| No columns disables Download | Task 3 browser; server 400 as a backstop (Task 2) |

## Risks

- **Label length grows with filters.** It's capped at three parts, all allowlisted.
- **Amount sort order.** `sortPayments` compares amounts as strings (`queries.ts:81`), and an amount-sorted export inherits that order. Out of scope here.

## Out of scope

- Fixing the amount sort. NWP-102 (yesterday's totals). Persistence (NWP-203). Showing `from`/`to` controls in the filter bar.

## Open questions

- None blocking. Closed: the amount keeps `formatMoney` (`csv.test.ts:5-9,34`), and "All payments" ignores merchant and search as well as status.
