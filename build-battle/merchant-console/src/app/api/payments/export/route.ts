import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  exportFilename,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * `columns` and `scope` are validated against allowlists before they reach a
 * query or a filename. `scope=all` ignores the table's filters and exports
 * every payment; `scope=filter` (the default) honors them, the same as the
 * table on screen. Both go through the one query builder.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const selection = parseExportColumns(params.get("columns"))
  if (!selection.ok) {
    return NextResponse.json({ error: selection.error }, { status: 400 })
  }

  const scope = parseExportScope(params.get("scope"))
  const requested = parseFilters(params)
  const filters =
    scope === "all"
      ? {
          ...requested,
          status: "all" as const,
          merchantId: undefined,
          search: undefined,
          from: undefined,
          to: undefined,
        }
      : requested

  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  const label =
    scope === "all"
      ? "all"
      : filters.status && filters.status !== "all"
        ? filters.status
        : "filtered"

  return new Response(toCsv(rows, selection.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(label)}"`,
    },
  })
}
