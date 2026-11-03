import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { ExportScope } from "@/data/types"
import { exportFilename, exportScopeToken, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Columns and scope come from the client and are checked against allowlists
 * before either reaches a query or the filename. The client's dialog disables
 * Download on an empty selection; this is the enforcement behind it.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const filters = parseFilters(params)

  const columns = parseExportColumns(params.get("columns"))
  if (columns === null) {
    return NextResponse.json(
      { message: "Pick at least one column to export." },
      { status: 400 },
    )
  }

  const scope: ExportScope = params.get("scope") === "all" ? "all" : "filter"

  // Scope "all" means every payment, so the same builder runs with no filters
  // rather than a second lookup. Sort still honours the table's order.
  const rows = sortPayments(
    filterPayments(scope === "all" ? {} : filters),
    filters.sort,
    filters.direction,
  )

  const filename = exportFilename(new Date(), exportScopeToken(filters, scope))

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
