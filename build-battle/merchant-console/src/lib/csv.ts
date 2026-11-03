import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses which columns ship (NWP-101). EXPORT_COLUMNS is the allowlist:
 * a column name from the client is only ever used after it has matched an
 * entry here. The card last four is opt-in, because most files go to a
 * merchant.
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

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Read the `columns` query param against the allowlist.
 *
 * - missing → DEFAULT_EXPORT_COLUMNS
 * - empty   → [] (the caller rejects it; an empty file helps nobody)
 * - list    → the requested columns, in the requested order, without repeats
 * - any name not in EXPORT_COLUMNS → null, so the whole request is rejected
 */
export function parseExportColumns(
  param: string | null,
): ExportColumn[] | null {
  if (param === null) return [...DEFAULT_EXPORT_COLUMNS]

  const names = param
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)

  const columns: ExportColumn[] = []
  for (const name of names) {
    if (!isExportColumn(name)) return null
    if (!columns.includes(name)) columns.push(name)
  }
  return columns
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
 * `payments-<scope>-YYYY-MM-DD.csv`, dated in UTC. The scope label must come
 * from validated values only (a known status, "all", "filtered"), never from
 * raw client text.
 */
export function exportFilename(date = new Date(), scope?: string): string {
  const day = date.toISOString().slice(0, 10)
  return scope ? `payments-${scope}-${day}.csv` : `payments-${day}.csv`
}
