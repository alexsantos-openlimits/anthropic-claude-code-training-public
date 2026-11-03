import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops picks the columns. The card last four is off unless asked for, because
 * these files go to merchants.
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

export type ColumnsResult =
  | { ok: true; columns: ExportColumn[] }
  | { ok: false; error: string }

/**
 * Checks a comma-separated column list from the client against the allowlist.
 * Keeps the requested order and drops repeats. A missing list means the
 * defaults; an empty or unknown one is rejected rather than guessed at.
 */
export function parseExportColumns(raw: string | null): ColumnsResult {
  if (raw === null) return { ok: true, columns: [...DEFAULT_EXPORT_COLUMNS] }

  const requested = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
  if (requested.length === 0) {
    return { ok: false, error: "Select at least one column to export." }
  }

  const columns: ExportColumn[] = []
  for (const name of requested) {
    if (!EXPORT_COLUMNS.includes(name as ExportColumn)) {
      return { ok: false, error: `Unknown column: ${name.slice(0, 40)}` }
    }
    if (!columns.includes(name as ExportColumn)) columns.push(name as ExportColumn)
  }
  return { ok: true, columns }
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

/** `payments-<scope>-<UTC date>.csv`; the scope part is left out when there is none. */
export function exportFilename(date = new Date(), scope?: string): string {
  const label = scope?.replace(/[^a-z0-9-]/gi, "").toLowerCase()
  const day = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}
