"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import type { ExportColumn } from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

const COLUMN_LABELS: Record<ExportColumn, string> = {
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

type Scope = "filter" | "all"

/**
 * Export options for the payments table (NWP-101).
 *
 * The browser only builds the download URL. The route re-validates every
 * column and the scope, and builds the file from the full result set, not
 * the page on screen.
 */
export function ExportDialog({
  filterQuery,
  currentCount,
  allCount,
  columns,
  defaultColumns,
}: {
  /** The table's active filters, already without `page`. */
  filterQuery: string
  currentCount: number
  allCount: number
  columns: ExportColumn[]
  defaultColumns: ExportColumn[]
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<Scope>("filter")
  const [selected, setSelected] = useState<ExportColumn[]>(defaultColumns)

  // Keep the table's column order whatever order boxes were ticked in.
  const ordered = columns.filter((column) => selected.includes(column))
  const rowCount = scope === "all" ? allCount : currentCount

  const toggle = (column: ExportColumn, checked: boolean) =>
    setSelected((current) =>
      checked
        ? [...current, column]
        : current.filter((value) => value !== column),
    )

  const query = new URLSearchParams(scope === "all" ? "" : filterQuery)
  query.set("scope", scope)
  query.set("columns", ordered.join(","))
  const href = `/api/payments/export?${query.toString()}`

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>
            Choose what goes into the CSV before you download it.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Payments to include
            </legend>
            {(
              [
                ["filter", "Current filter", currentCount],
                ["all", "All payments", allCount],
              ] as const
            ).map(([value, label, count]) => (
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
                <span className="tabular-nums text-gray-500">
                  ({count.toLocaleString()} payments)
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            {columns.map((column) => (
              <label
                key={column}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  type="checkbox"
                  name="export-columns"
                  value={column}
                  checked={selected.includes(column)}
                  onChange={(event) => toggle(column, event.target.checked)}
                  className="size-4 accent-blue-500"
                />
                {COLUMN_LABELS[column]}
                {column === "last4" && (
                  <span className="text-gray-500">
                    (off by default, for files going to merchants)
                  </span>
                )}
              </label>
            ))}
          </fieldset>
        </DrawerBody>

        <DrawerFooter className="items-center gap-2">
          <p
            className="mr-auto text-sm text-gray-500"
            role="status"
            aria-live="polite"
          >
            {ordered.length === 0
              ? "Choose at least one column."
              : `${rowCount.toLocaleString()} rows · ${ordered.length} columns`}
          </p>
          <DrawerClose asChild>
            <Button variant="secondary" className="w-full sm:w-fit">
              Cancel
            </Button>
          </DrawerClose>
          {ordered.length === 0 ? (
            <Button disabled className="w-full gap-2 sm:w-fit">
              <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
              Download CSV
            </Button>
          ) : (
            <Button asChild className="w-full gap-2 sm:w-fit">
              <a href={href} download onClick={() => setOpen(false)}>
                <Download
                  className="-ml-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                Download CSV
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
