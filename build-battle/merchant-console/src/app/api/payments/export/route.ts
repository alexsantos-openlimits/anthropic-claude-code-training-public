import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  exportFilename,
  exportLabel,
  parseColumns,
  parseScope,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * `columns` (comma-separated) is checked against the export allowlist and
 * `scope` is "filtered" (default) or "all". Filtering goes through the same
 * query builder as GET /api/payments, unpaginated, so the file holds every
 * matching row rather than the page on screen.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const columns = parseColumns(params.get("columns"))
  if (columns === null) {
    return NextResponse.json({ error: "Unknown export column" }, { status: 400 })
  }
  if (columns.length === 0) {
    return NextResponse.json({ error: "Select at least one column" }, { status: 400 })
  }

  const scope = parseScope(params.get("scope"))
  const filters = parseFilters(scope === "all" ? new URLSearchParams() : params)
  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  const filename = exportFilename(new Date(), exportLabel(filters, scope))
  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
