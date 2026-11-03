import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  exportFilename,
  exportLabel,
  parseExportColumns,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Honors the active filters and reuses the query builder. The optional
 * `columns` param (comma-separated) picks the columns; it is validated against
 * an allowlist and defaults to the standard set. Invalid input is a 400.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const columns = parseExportColumns(params.get("columns"))
  if (!columns) {
    return NextResponse.json(
      { error: "Choose at least one valid column." },
      { status: 400 },
    )
  }

  const filters = parseFilters(params)
  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), exportLabel(filters))}"`,
    },
  })
}
