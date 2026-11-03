"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import { DEFAULT_EXPORT_COLUMNS, EXPORT_COLUMNS, ExportColumn } from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

type Scope = "filter" | "all"

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Date",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

export function ExportDialog({
  filterQuery,
  filteredCount,
  allCount,
}: {
  /** The active filters as a query string, without page or sort. */
  filterQuery: string
  filteredCount: number
  allCount: number
}) {
  const [columns, setColumns] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<Scope>("filter")

  const toggle = (column: ExportColumn) =>
    setColumns((current) =>
      current.includes(column)
        ? current.filter((name) => name !== column)
        : // Keep the table's column order rather than the click order.
          EXPORT_COLUMNS.filter((name) => name === column || current.includes(name)),
    )

  const rowCount = scope === "filter" ? filteredCount : allCount
  const canDownload = columns.length > 0

  const params = new URLSearchParams(scope === "filter" ? filterQuery : "")
  params.set("scope", scope)
  params.set("columns", columns.join(","))

  return (
    <Drawer>
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
            Choose what goes in the CSV. Card last four is off by default.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === "filter"}
                  onChange={() => setScope("filter")}
                />
                Current filter ({filteredCount.toLocaleString("en-US")})
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                />
                All payments ({allCount.toLocaleString("en-US")})
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={columns.includes(column)}
                    onChange={() => toggle(column)}
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
            {!canDownload && (
              <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-500">
                Select at least one column to download.
              </p>
            )}
          </fieldset>
        </DrawerBody>
        <DrawerFooter className="items-center">
          <p className="mb-2 text-sm text-gray-500 sm:mb-0 sm:mr-auto" aria-live="polite">
            {rowCount.toLocaleString("en-US")} {rowCount === 1 ? "row" : "rows"} will be
            exported
          </p>
          {canDownload ? (
            <Button asChild>
              <a href={`/api/payments/export?${params.toString()}`}>Download CSV</a>
            </Button>
          ) : (
            <Button disabled>Download CSV</Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
