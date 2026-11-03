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

type Scope = "current" | "all"

/**
 * Export options for the payments table. Everything chosen here is a
 * convenience; the route handler validates columns and scope again.
 */
export function ExportDialog({
  columns,
  defaultColumns,
  query,
  currentCount,
  allCount,
}: {
  columns: readonly string[]
  defaultColumns: readonly string[]
  query: string
  currentCount: number
  allCount: number
}) {
  const [selected, setSelected] = useState<string[]>([...defaultColumns])
  const [scope, setScope] = useState<Scope>("current")

  const toggle = (column: string, checked: boolean) =>
    setSelected((previous) =>
      checked
        ? columns.filter((c) => c === column || previous.includes(c))
        : previous.filter((c) => c !== column),
    )

  const rowCount = scope === "all" ? allCount : currentCount
  const params = new URLSearchParams(query)
  params.delete("page")
  params.set("scope", scope)
  params.set("columns", selected.join(","))
  const href = `/api/payments/export?${params.toString()}`
  const canDownload = selected.length > 0

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
            Choose what goes into the CSV.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 flex flex-col gap-2">
              {(
                [
                  ["current", "Current filter", currentCount],
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
                  <span className="text-gray-500 tabular-nums">
                    ({count.toLocaleString()})
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {columns.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(column)}
                    onChange={(event) => toggle(column, event.target.checked)}
                    className="size-4 accent-blue-500"
                  />
                  {COLUMN_LABELS[column] ?? column}
                </label>
              ))}
            </div>
          </fieldset>
        </DrawerBody>

        <DrawerFooter className="items-center gap-2">
          <p
            className="mr-auto text-sm text-gray-500 tabular-nums"
            aria-live="polite"
          >
            {canDownload
              ? `${rowCount.toLocaleString()} payments will be exported`
              : "Select at least one column"}
          </p>
          <DrawerClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DrawerClose>
          {canDownload ? (
            <Button variant="primary" className="py-1.5" asChild>
              <a href={href}>Download</a>
            </Button>
          ) : (
            <Button variant="primary" className="py-1.5" disabled>
              Download
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
