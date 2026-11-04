"use client"

import { Button } from "@/components/Button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/Dialog"
import { Download } from "lucide-react"
import { useState } from "react"

const LABELS: Record<string, string> = {
  id: "Payment ID",
  created_at: "Created (UTC)",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

type Scope = "filtered" | "all"

/**
 * Options for the payments CSV export. The server validates every choice
 * again; this only builds the request and keeps ops from asking for an
 * empty file.
 */
export function ExportDialog({
  query,
  columns,
  defaultColumns,
  filteredCount,
  totalCount,
}: {
  query: string
  columns: string[]
  defaultColumns: string[]
  filteredCount: number
  totalCount: number
}) {
  const [selected, setSelected] = useState<string[]>(defaultColumns)
  const [scope, setScope] = useState<Scope>("filtered")

  const toggle = (column: string) =>
    setSelected((current) =>
      current.includes(column)
        ? current.filter((c) => c !== column)
        : [...current, column],
    )

  const count = scope === "all" ? totalCount : filteredCount
  const ordered = columns.filter((column) => selected.includes(column))

  const params = new URLSearchParams(scope === "all" ? "" : query)
  params.delete("page")
  params.set("scope", scope)
  params.set("columns", ordered.join(","))
  const href = `/api/payments/export?${params.toString()}`

  const blocked =
    ordered.length === 0
      ? "Select at least one column to download."
      : count === 0
        ? "No payments match this scope."
        : null

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export payments</DialogTitle>
          <DialogDescription>
            Choose what goes in the CSV. Card last four is off by default.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Scope
          </legend>
          <div className="mt-2 flex flex-col gap-2">
            {(
              [
                ["filtered", "Current filter", filteredCount],
                ["all", "All payments", totalCount],
              ] as const
            ).map(([value, label, rows]) => (
              <label
                key={value}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  type="radio"
                  name="export-scope"
                  value={value}
                  checked={scope === value}
                  onChange={() => setScope(value)}
                  className="size-4 accent-blue-500"
                />
                {label}
                <span className="text-gray-500">
                  ({rows.toLocaleString()} {rows === 1 ? "payment" : "payments"})
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-6">
          <div className="flex items-center justify-between">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="flex gap-3 text-sm">
              <button
                type="button"
                className="text-blue-600 hover:underline dark:text-blue-500"
                onClick={() => setSelected(columns)}
              >
                Select all
              </button>
              <button
                type="button"
                className="text-blue-600 hover:underline dark:text-blue-500"
                onClick={() => setSelected([])}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {columns.map((column) => (
              <label
                key={column}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(column)}
                  onChange={() => toggle(column)}
                  className="size-4 accent-blue-500"
                />
                {LABELS[column] ?? column}
              </label>
            ))}
          </div>
        </fieldset>

        <p
          className="mt-6 min-h-5 text-sm text-gray-500"
          role="status"
          aria-live="polite"
        >
          {blocked ??
            `${count.toLocaleString()} ${count === 1 ? "row" : "rows"}, ${ordered.length} ${ordered.length === 1 ? "column" : "columns"}`}
        </p>

        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          {blocked ? (
            <Button disabled>Download</Button>
          ) : (
            <Button asChild>
              <a href={href} download>
                Download
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
