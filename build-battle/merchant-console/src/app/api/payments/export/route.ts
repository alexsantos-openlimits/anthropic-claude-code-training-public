import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

const SCOPES = ["filter", "all"] as const

/**
 * Exports the payments table as CSV.
 *
 * `columns` (comma-separated) and `scope` (`filter` or `all`) come from the
 * client, so both are checked against allowlists before anything is built.
 * Filtering still goes through the shared query builder.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const scope = params.get("scope") ?? "filter"
  if (!SCOPES.includes(scope as (typeof SCOPES)[number])) {
    return NextResponse.json(
      { error: "Scope must be 'filter' or 'all'." },
      { status: 400 },
    )
  }

  const parsed = parseExportColumns(params.get("columns"))
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const filters = parseFilters(scope === "all" ? new URLSearchParams() : params)
  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  const label =
    scope === "all" ? "all" : filters.status !== "all" ? filters.status : undefined

  return new Response(toCsv(rows, parsed.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), label)}"`,
    },
  })
}
