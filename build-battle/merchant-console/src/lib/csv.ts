import { merchantById } from "@/data/merchants"
import { ExportScope, Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). EXPORT_COLUMNS is the
 * allowlist every request is checked against; DEFAULT_EXPORT_COLUMNS is what
 * an export ships when nobody says otherwise, and it leaves the card last
 * four out so a file going to a merchant is safe by default.
 */

export const EXPORT_COLUMNS = [
  "id",
  "created_at",
  "merchant",
  "description",
  "status",
  "method",
  "card_brand",
  "last4",
  "amount",
  "currency",
] as const

export type ExportColumn = (typeof EXPORT_COLUMNS)[number]

/**
 * What an export ships when the request names no columns. Card last four is
 * opt-in: ORG-STANDARDS #8 masks card data everywhere, and an unedited file
 * carrying it is the near-miss this ticket exists to stop.
 */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Validate a client-supplied column list against the allowlist.
 *
 * Returns null when the list names anything unknown or resolves to nothing,
 * so the caller can reject rather than quietly export a different file than
 * the one that was asked for. Duplicates collapse; the caller's order wins.
 */
export function parseExportColumns(raw: string | null): ExportColumn[] | null {
  if (raw === null) return [...DEFAULT_EXPORT_COLUMNS]

  const names = raw
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0)

  if (names.length === 0) return null
  if (!names.every(isExportColumn)) return null

  return [...new Set(names)]
}

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function cell(payment: Payment, column: ExportColumn): string {
  switch (column) {
    case "id":
      return payment.id
    case "created_at":
      return payment.createdAt
    case "merchant":
      return merchantById(payment.merchantId)?.name ?? payment.merchantId
    case "description":
      return payment.description
    case "status":
      return payment.status
    case "method":
      return payment.method
    case "card_brand":
      return payment.cardBrand ?? ""
    case "last4":
      return payment.last4 ?? ""
    case "amount":
      return formatMoney(payment.amount, payment.currency)
    case "currency":
      return payment.currency
  }
}

export function toCsv(
  payments: Payment[],
  columns: readonly ExportColumn[] = EXPORT_COLUMNS,
): string {
  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

/**
 * The scope word that goes in the filename, so a file names the rows it
 * holds: the status when one is filtering, "filtered" when something else is,
 * and "all" for an unfiltered table or an explicit all-payments export.
 */
export function exportScopeToken(
  filters: PaymentFilters,
  scope: ExportScope,
): string {
  if (scope === "all") return "all"
  if (filters.status && filters.status !== "all") return filters.status
  if (filters.merchantId || filters.search || filters.from || filters.to) {
    return "filtered"
  }
  return "all"
}

/**
 * Date is UTC, matching how payments are stored and bucketed. Two exports of
 * the same scope on the same day collide by design.
 */
export function exportFilename(date = new Date(), scope?: string): string {
  const day = date.toISOString().slice(0, 10)
  const token = scope?.replace(/[^a-z0-9-]/gi, "").toLowerCase()
  return token
    ? `payments-${token}-${day}.csv`
    : `payments-${day}.csv`
}
