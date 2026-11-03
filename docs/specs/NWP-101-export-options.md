# SPEC · NWP-101 — Payments export options

> Written before any code, then edited as it was built.
> Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** anthonyrizo83, with Claude Code
**Status:** done

## Problem

Ops exports the payments table several times a day, and every file carries every column, card last four included. Anything going to a merchant is cleaned up by hand first: 3–4 hours a month, and last quarter an unedited file nearly went to the wrong merchant.

## Current state

- `build-battle/merchant-console/src/app/payments/page.tsx:69` — Export is a plain `<a>` to `/api/payments/export?<current query>`. No options.
- `src/app/api/payments/export/route.ts:11` — `parseFilters()` → `filterPayments()` → `sortPayments()`. It already skips `paginate()`, so the file has every matching row, not just the visible page.
- `src/lib/csv.ts:58` — `toCsv(rows, columns = EXPORT_COLUMNS)` already writes any subset in the order given (covered by `csv.test.ts`). The route never passes a subset.
- `src/lib/csv.ts:69` — `exportFilename()` stamps the date only.
- `src/data/queries.ts:18` — `parseFilters()` is the allowlist for filter params. The query builder lives in the same file.
- Mismatch: `.claude/rules/components.md` mentions a Dialog component. There isn't one. `src/components/Drawer.tsx` is the existing Radix Dialog primitive.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Validate everything from the client against an allowlist before it reaches a query or a filename | `.claude/rules/api-routes.md` | Arbitrary column names reach the serializer; client text lands in a response header |
| Reuse the query builder | `merchant-console/CLAUDE.md`, the ticket | A second filter path drifts from the table |
| Money is integer minor units, formatted once on the way out | `merchant-console/CLAUDE.md` | Cents drift in exported totals |
| Dialogs are operable: labelled inputs, accessible name, focus in and back, Escape closes | `.claude/rules/components.md` | Keyboard and screen-reader users can't export |

## Approach

Keep the export on the server. Add a validated `columns` param (comma-separated, checked against `EXPORT_COLUMNS`, last four off when absent) and a `scope` param (`filter` or `all`) to the existing route. Both scopes go through `parseFilters` and `filterPayments`, and the filename label comes only from allowlisted values. The dialog builds that URL and links to it. The row counts come from the server page that already has them.

**Considered and rejected:** building the CSV in the browser from the table's rows. The table is paginated, so it would export the current page only, which is the bug the ticket warns about.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | Change | `DEFAULT_EXPORT_COLUMNS`, `parseExportColumns()`, `exportFilename(date, label)` |
| `src/app/api/payments/export/route.ts` | Change | Validate `scope` and `columns`, return 400 `{ error }` early, set the label on the filename |
| `src/lib/csv.test.ts` | Change | Subset order, last four off by default, empty and unknown selections rejected, labelled filename |
| `src/app/payments/export-dialog.tsx` | Add | Drawer with scope radios, column checkboxes, Download link |
| `src/app/payments/page.tsx` | Change | Render the dialog in place of the bare link, pass counts and column lists |

## Plan

1. **Column parsing and filename in `csv.ts`** — done when: existing csv tests still pass unchanged.
2. **Route validation and scope** — done when: curl shows 400 for `columns=`, `columns=id,pan` and `scope=everything`, and the right header and filename for valid requests.
3. **Tests** — done when: the new csv tests pass alongside the old ones.
4. **Dialog** — done when: in the browser, last four starts unchecked, counts switch with scope, an empty selection disables Download, and Escape returns focus to Export.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Choose columns, last four off by default | `csv.test.ts` "leaves the card last four out by default". Browser: checkbox unchecked on open. curl with no params: header has no `last4` |
| Choose scope, current filter default, row count visible | Browser on `?status=disputed`: "Current filter (33 rows)" selected, "All payments (1,658 rows)". `scope=all` returns 1,658 rows plus a header |
| Filename reflects scope and date | curl: `payments-disputed-<date>.csv`, `payments-all-<date>.csv`. Unit test on `exportFilename` |
| Minor units internally, formatted once, currency in its own column | Unchanged: `cell()` calls `formatMoney` once, and `currency` is its own column |
| Deselecting every column disables Download | Browser: Clear → Download disabled, no link rendered, message shown. Server rejects `columns=` with 400 as well |
| Unit test covers the serializer, `npm test` passes | 35 of 35 tests pass, 7 of them new in `csv.test.ts` |

## Risks

- Client strings in the `Content-Disposition` header. Handled: the label is only `all`, `filtered` or an allowlisted status.
- The page's row count comes from its own hand-built filters, while the route uses `parseFilters`. They match for every parameter the filter bar sends today.

## Out of scope

- Sorting by amount compares numbers as text (`src/data/queries.ts:81`). It's a separate defect and not this ticket.
- `page.tsx` builds filters by hand instead of calling `parseFilters()`. Left alone to keep the diff to the ticket.
- Changing the amount cell format (`$250.00`). The existing tests pin it.

## Open questions

- Should the filename use the wall-clock date (current behaviour) or the dataset's `GENERATED_AT` date, which the ticket's example happens to match?
