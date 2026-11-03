import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { ExportScope } from "@/data/types"
import {
  exportFilename,
  exportScopeToken,
  parseExportColumns,
  parseExportFormat,
  toCsv,
  toJson,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/** A preview is the first lines of the real file, never a second serializer. */
const PREVIEW_ROWS = 5

const CONTENT_TYPE = {
  csv: "text/csv; charset=utf-8",
  json: "application/json; charset=utf-8",
} as const

/**
 * Exports the payments table.
 *
 * Columns, scope and format all come from the client and are checked against
 * allowlists before either reaches a query or the filename. The client's
 * dialog disables Download on an empty selection; this is the enforcement
 * behind it.
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

  const format = parseExportFormat(params.get("format"))
  if (format === null) {
    return NextResponse.json(
      { message: "That export format is not supported." },
      { status: 400 },
    )
  }

  const scope: ExportScope = params.get("scope") === "all" ? "all" : "filter"
  const preview = params.get("preview") === "1"

  // Scope "all" means every payment, so the same builder runs with no filters
  // rather than a second lookup. Sort still honours the table's order.
  const sorted = sortPayments(
    filterPayments(scope === "all" ? {} : filters),
    filters.sort,
    filters.direction,
  )
  const rows = preview ? sorted.slice(0, PREVIEW_ROWS) : sorted

  const body = format === "json" ? toJson(rows, columns) : toCsv(rows, columns)

  if (preview) {
    return new Response(body, {
      headers: { "content-type": "text/plain; charset=utf-8" },
    })
  }

  const filename = exportFilename(
    new Date(),
    exportScopeToken(filters, scope),
    format,
  )

  return new Response(body, {
    headers: {
      "content-type": CONTENT_TYPE[format],
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
