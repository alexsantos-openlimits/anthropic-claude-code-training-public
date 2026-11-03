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
import { Download } from "lucide-react"
import { useState } from "react"

const COLUMN_LABELS: Record<string, string> = {
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

export function ExportDialog({
  query,
  columns,
  defaultColumns,
  filteredCount,
  allCount,
}: {
  /** The current filters as a query string, without `page`. */
  query: string
  columns: readonly string[]
  defaultColumns: readonly string[]
  filteredCount: number
  allCount: number
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<Scope>("filter")
  const [selected, setSelected] = useState(() => new Set(defaultColumns))

  const chosen = columns.filter((column) => selected.has(column))
  const rowCount = scope === "filter" ? filteredCount : allCount

  const params = new URLSearchParams(query)
  params.set("scope", scope)
  params.set("columns", chosen.join(","))
  const href = `/api/payments/export?${params.toString()}`

  const toggle = (column: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

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
      <DrawerContent className="sm:max-w-md">
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>
            Choose the rows and columns for the CSV file.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Rows
            </legend>
            <ScopeOption
              value="filter"
              current={scope}
              onChange={setScope}
              label="Current filter"
              count={filteredCount}
            />
            <ScopeOption
              value="all"
              current={scope}
              onChange={setScope}
              label="All payments"
              count={allCount}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <div className="mb-2 flex items-center justify-between">
              <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
                Columns
              </legend>
              <div className="flex gap-3 text-sm">
                <button
                  type="button"
                  className="text-blue-600 hover:underline dark:text-blue-500"
                  onClick={() => setSelected(new Set(columns))}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="text-blue-600 hover:underline dark:text-blue-500"
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </button>
              </div>
            </div>
            {columns.map((column) => (
              <label
                key={column}
                htmlFor={`export-column-${column}`}
                className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  id={`export-column-${column}`}
                  type="checkbox"
                  checked={selected.has(column)}
                  onChange={() => toggle(column)}
                  className="mt-0.5 size-4 shrink-0 accent-blue-500"
                />
                <span>
                  {COLUMN_LABELS[column] ?? column}
                  {column === "last4" && (
                    <span className="block text-xs text-gray-500">
                      Leave off for files going to a merchant.
                    </span>
                  )}
                </span>
              </label>
            ))}
          </fieldset>
        </DrawerBody>

        <DrawerFooter className="items-center gap-2">
          {chosen.length === 0 && (
            <p
              role="status"
              className="mr-auto text-sm text-gray-500 max-sm:mt-2"
            >
              Choose at least one column.
            </p>
          )}
          <DrawerClose asChild>
            <Button variant="secondary" className="w-full sm:w-fit">
              Cancel
            </Button>
          </DrawerClose>
          {chosen.length === 0 ? (
            <Button disabled className="w-full sm:w-fit">
              Download
            </Button>
          ) : (
            <Button asChild className="w-full sm:w-fit">
              <a href={href} onClick={() => setOpen(false)}>
                Download {rowCount.toLocaleString()}{" "}
                {rowCount === 1 ? "row" : "rows"}
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function ScopeOption({
  value,
  current,
  onChange,
  label,
  count,
}: {
  value: Scope
  current: Scope
  onChange: (scope: Scope) => void
  label: string
  count: number
}) {
  return (
    <label
      htmlFor={`export-scope-${value}`}
      className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300"
    >
      <input
        id={`export-scope-${value}`}
        type="radio"
        name="export-scope"
        value={value}
        checked={current === value}
        onChange={() => onChange(value)}
        className="size-4 shrink-0 accent-blue-500"
      />
      <span>
        {label}{" "}
        <span className="tabular-nums text-gray-500">
          ({count.toLocaleString()} {count === 1 ? "row" : "rows"})
        </span>
      </span>
    </label>
  )
}
