import { merchantById } from "@/data/merchants"
import { Payment, PaymentFilters } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * The default column set is every column except the card last four. A
 * caller may ask for its own subset and order (NWP-101); the request is
 * checked against EXPORT_COLUMNS in parseExportColumns.
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

export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] = EXPORT_COLUMNS.filter(
  (c) => c !== "last4",
)

/** null means invalid: empty, unknown or repeated column. */
export function parseExportColumns(raw: string | null): ExportColumn[] | null {
  if (raw === null) return [...DEFAULT_EXPORT_COLUMNS]
  const parts = raw.split(",")
  const valid = parts.every(
    (p, i) => (EXPORT_COLUMNS as readonly string[]).includes(p) && parts.indexOf(p) === i,
  )
  return valid ? (parts as ExportColumn[]) : null
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

/** Filename label from allowlisted values only; search text never gets in. */
export function exportLabel(filters: PaymentFilters): string {
  const parts: string[] = []
  if (filters.status && filters.status !== "all") parts.push(filters.status)
  const merchantKnown = filters.merchantId ? !!merchantById(filters.merchantId) : true
  if (filters.merchantId && merchantKnown) parts.push(filters.merchantId)
  if (filters.search || filters.from || filters.to || !merchantKnown) parts.push("filtered")
  return parts.join("-") || "all"
}

export function exportFilename(date = new Date(), label?: string): string {
  const day = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}
