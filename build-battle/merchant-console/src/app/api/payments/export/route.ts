import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Query params, all validated here before use:
 * - `scope`: "filter" (default) uses the same filters as the table;
 *   "all" ignores them.
 * - `columns`: comma-separated names from EXPORT_COLUMNS, in output order.
 *   Missing means the defaults, which leave out the card last four.
 * - the usual payment filters, read through parseFilters.
 *
 * Filtering and sorting go through the one query builder. Pagination is
 * deliberately skipped: the file holds every matching row, not one page.
 */

const SCOPES = ["filter", "all"] as const
type Scope = (typeof SCOPES)[number]

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

/** Built only from validated values, so nothing raw reaches the filename. */
function scopeLabel(scope: Scope, filters: PaymentFilters): string {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  if (filters.merchantId || filters.search || filters.from || filters.to) {
    return "filtered"
  }
  return "all"
}

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const scope = params.get("scope") ?? "filter"
  if (!SCOPES.includes(scope as Scope)) {
    return badRequest('Unknown export scope. Use "filter" or "all".')
  }

  const columns = parseExportColumns(params.get("columns"))
  if (columns === null) {
    return badRequest("One or more requested columns do not exist.")
  }
  if (columns.length === 0) {
    return badRequest("Choose at least one column to export.")
  }

  const parsed = parseFilters(params)
  const filters: PaymentFilters =
    scope === "all"
      ? { sort: parsed.sort, direction: parsed.direction }
      : parsed

  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(
        new Date(),
        scopeLabel(scope as Scope, filters),
      )}"`,
    },
  })
}
