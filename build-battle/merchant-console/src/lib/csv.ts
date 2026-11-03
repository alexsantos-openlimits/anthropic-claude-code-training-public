import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). The card last four is left
 * out unless someone asks for it, because these files go to merchants.
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

export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

export const EXPORT_SCOPES = ["filter", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

export type ColumnSelection =
  | { ok: true; columns: ExportColumn[] }
  | { ok: false; error: string }

/**
 * Turns the `columns` query param into an allowlisted, de-duplicated list in
 * the order the client asked for. Missing means the defaults. Empty is an
 * error, because an empty file is never what anyone wants.
 */
export function parseExportColumns(raw: string | null): ColumnSelection {
  if (raw === null) return { ok: true, columns: [...DEFAULT_EXPORT_COLUMNS] }

  const requested = raw
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "")
  const columns: ExportColumn[] = []

  for (const name of requested) {
    if (!EXPORT_COLUMNS.includes(name as ExportColumn)) {
      return { ok: false, error: `Unknown export column: ${name}` }
    }
    if (!columns.includes(name as ExportColumn)) {
      columns.push(name as ExportColumn)
    }
  }

  if (columns.length === 0) {
    return { ok: false, error: "Select at least one column" }
  }
  return { ok: true, columns }
}

export function parseExportScope(raw: string | null): ExportScope {
  return EXPORT_SCOPES.includes(raw as ExportScope)
    ? (raw as ExportScope)
    : "filter"
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
 * `label` is a status or one of the scope words, never free text from the
 * client. The route passes only allowlisted values.
 */
export function exportFilename(label: string, date = new Date()): string {
  return `payments-${label}-${date.toISOString().slice(0, 10)}.csv`
}
