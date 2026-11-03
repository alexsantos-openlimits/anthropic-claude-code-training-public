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
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
  exportHref,
} from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "ID",
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

const OPTION = "flex items-center gap-2 text-sm text-gray-900 dark:text-gray-50"
const INPUT = "size-4 accent-blue-600"
const LEGEND = "mb-2 text-sm font-medium text-gray-900 dark:text-gray-50"

export function ExportDialog({
  filterQuery,
  filteredCount,
  allCount,
}: {
  filterQuery: string
  filteredCount: number
  allCount: number
}) {
  const [scope, setScope] = useState<"filter" | "all">("filter")
  const [selected, setSelected] = useState<Set<ExportColumn>>(
    () => new Set(DEFAULT_EXPORT_COLUMNS),
  )
  const columns = EXPORT_COLUMNS.filter((c) => selected.has(c))

  const toggle = (column: ExportColumn) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (!next.delete(column)) next.add(column)
      return next
    })

  return (
    <Drawer
      onOpenChange={(open) => {
        if (!open) return
        setScope("filter")
        setSelected(new Set(DEFAULT_EXPORT_COLUMNS))
      }}
    >
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
            Choose which rows and columns go into the CSV. Card last four is off by default.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2">
            <legend className={LEGEND}>Rows</legend>
            <label className={OPTION}>
              <input
                type="radio"
                name="scope"
                className={INPUT}
                checked={scope === "filter"}
                onChange={() => setScope("filter")}
              />
              Current filter ({filteredCount.toLocaleString()} payments)
            </label>
            <label className={OPTION}>
              <input
                type="radio"
                name="scope"
                className={INPUT}
                checked={scope === "all"}
                onChange={() => setScope("all")}
              />
              All payments ({allCount.toLocaleString()} payments)
            </label>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className={LEGEND}>Columns</legend>
            {EXPORT_COLUMNS.map((column) => (
              <label key={column} className={OPTION}>
                <input
                  type="checkbox"
                  className={INPUT}
                  checked={selected.has(column)}
                  onChange={() => toggle(column)}
                />
                {COLUMN_LABELS[column]}
              </label>
            ))}
          </fieldset>
        </DrawerBody>
        <DrawerFooter className="items-center">
          {columns.length === 0 && (
            <p id="export-columns-hint" role="status" className="mb-2 text-sm text-gray-500 sm:mb-0 sm:mr-auto">
              Choose at least one column.
            </p>
          )}
          <DrawerClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DrawerClose>
          {columns.length > 0 ? (
            <Button asChild className="mb-2 sm:mb-0">
              <a href={exportHref(filterQuery, scope, columns)}>Download</a>
            </Button>
          ) : (
            <Button disabled aria-describedby="export-columns-hint" className="mb-2 sm:mb-0">
              <span>Download</span>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
