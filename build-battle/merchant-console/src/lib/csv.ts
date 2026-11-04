import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Column names arrive from
 * the client, so `parseColumns` checks them against EXPORT_COLUMNS before
 * they reach the serializer. The card last four is off unless asked for.
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

/** What ships when the client does not choose: everything but the last four. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export const EXPORT_SCOPES = ["filtered", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

/**
 * Validate a comma-separated `columns` param against the allowlist.
 *
 * Missing means the default set. Present but empty is an explicit empty
 * selection, returned as `[]` so the caller can refuse it. Any unknown name
 * rejects the whole request with `null`. Order is kept; duplicates are dropped.
 */
export function parseColumns(raw: string | null): ExportColumn[] | null {
  if (raw === null) return [...DEFAULT_EXPORT_COLUMNS]

  const names = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)

  const columns: ExportColumn[] = []
  for (const name of names) {
    if (!EXPORT_COLUMNS.includes(name as ExportColumn)) return null
    if (!columns.includes(name as ExportColumn)) columns.push(name as ExportColumn)
  }
  return columns
}

export function parseScope(raw: string | null): ExportScope {
  return raw === "all" ? "all" : "filtered"
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
 * A filename-safe description of what an export contains, built only from
 * validated values. Search text and dates are free-form client input, so
 * they never reach the filename; they read as "filtered".
 */
export function exportLabel(filters: PaymentFilters, scope: ExportScope): string {
  if (scope === "all") return "all"

  const parts: string[] = []
  if (filters.status && filters.status !== "all") parts.push(filters.status)
  const merchant = filters.merchantId ? merchantById(filters.merchantId) : undefined
  if (merchant) parts.push(merchant.id)

  if (parts.length === 0) {
    const filtered = filters.search || filters.from || filters.to || filters.merchantId
    return filtered ? "filtered" : "all"
  }
  return parts.join("-").toLowerCase().replace(/[^a-z0-9_-]/g, "")
}

export function exportFilename(date = new Date(), label?: string): string {
  const day = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}
