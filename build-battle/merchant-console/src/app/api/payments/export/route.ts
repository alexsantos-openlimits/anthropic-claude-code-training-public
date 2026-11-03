import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import { PaymentFilters } from "@/data/types"
import { exportFilename, parseExportColumns, toCsv } from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

const SCOPES = ["filter", "all"] as const
type Scope = (typeof SCOPES)[number]

function isScope(value: string): value is Scope {
  return (SCOPES as readonly string[]).includes(value)
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

/** Built from allowlisted values only, never from search text or ids. */
function fileLabel(scope: Scope, filters: PaymentFilters): string {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  if (filters.merchantId || filters.search || filters.from || filters.to) {
    return "filtered"
  }
  return "all"
}

/**
 * Exports payments as CSV. `scope` is "filter" (default, honours the active
 * filters) or "all"; `columns` is a comma-separated allowlisted list.
 * Both paths go through the query builder and skip pagination.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const scope = params.get("scope") ?? "filter"
  if (!isScope(scope)) return badRequest('Scope must be "filter" or "all".')

  const selection = parseExportColumns(params.get("columns"))
  if (!selection.ok) return badRequest(selection.error)

  const filters = parseFilters(
    scope === "all" ? new URLSearchParams() : params,
  )
  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )
  const filename = exportFilename(new Date(), fileLabel(scope, filters))

  return new Response(toCsv(rows, selection.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
