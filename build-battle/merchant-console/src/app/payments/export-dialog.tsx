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
import { ExportScope } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
} from "@/lib/csv"
import { cx, focusRing } from "@/lib/utils"
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

const CONTROL = cx(
  "size-4 shrink-0 border-gray-300 text-blue-500 dark:border-gray-700",
  "bg-white dark:bg-gray-950",
  focusRing,
)

export function ExportOptionsDialog({
  query,
  filteredCount,
  allCount,
}: {
  query: string
  filteredCount: number
  allCount: number
}) {
  const [selected, setSelected] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<ExportScope>("filter")

  const toggle = (column: ExportColumn) =>
    setSelected((current) =>
      current.includes(column)
        ? current.filter((name) => name !== column)
        : EXPORT_COLUMNS.filter(
            (name) => name === column || current.includes(name),
          ),
    )

  const rowCount = scope === "all" ? allCount : filteredCount
  const nothingSelected = selected.length === 0

  // Scope "all" deliberately drops the table's filters, so the URL says what
  // the file holds. The server validates both params again regardless.
  const params = new URLSearchParams(scope === "all" ? "" : query)
  params.delete("page")
  params.set("columns", selected.join(","))
  if (scope === "all") params.set("scope", "all")

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

      <DrawerContent className="sm:max-w-md">
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription className="text-sm">
            Pick the columns and the rows. Card last four is left out unless
            you ask for it.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Rows
            </legend>
            <div className="mt-2 space-y-2">
              {(
                [
                  ["filter", "Current filter", filteredCount],
                  ["all", "All payments (ignores filters)", allCount],
                ] as const
              ).map(([value, label, count]) => (
                <label
                  key={value}
                  className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-50"
                >
                  <input
                    type="radio"
                    name="scope"
                    value={value}
                    checked={scope === value}
                    onChange={() => setScope(value)}
                    className={CONTROL}
                  />
                  <span>{label}</span>
                  <span className="text-gray-500 tabular-nums dark:text-gray-500">
                    {count.toLocaleString()}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(column)}
                    onChange={() => toggle(column)}
                    className={cx(CONTROL, "rounded")}
                  />
                  <span>{COLUMN_LABELS[column]}</span>
                </label>
              ))}
            </div>
            {nothingSelected && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-500">
                Pick at least one column to export.
              </p>
            )}
          </fieldset>
        </DrawerBody>

        <DrawerFooter>
          <p className="mr-auto self-center text-sm text-gray-500 tabular-nums dark:text-gray-500">
            {rowCount.toLocaleString()} {rowCount === 1 ? "row" : "rows"} ·{" "}
            {selected.length} {selected.length === 1 ? "column" : "columns"}
          </p>
          {nothingSelected ? (
            <Button disabled>Download CSV</Button>
          ) : (
            <Button asChild>
              <a href={`/api/payments/export?${params.toString()}`} download>
                Download CSV
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
