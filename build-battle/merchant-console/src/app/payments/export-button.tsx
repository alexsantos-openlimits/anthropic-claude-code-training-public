"use client"

import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
} from "@/lib/csv"
import * as Dialog from "@radix-ui/react-dialog"
import { Download } from "lucide-react"
import { useEffect, useState } from "react"
import { LABELS as STATUS_LABELS } from "./filter-bar"

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

type Scope = "filter" | "all" | "modify"

const SCOPES: { value: Scope; label: string }[] = [
  { value: "filter", label: "Current filter" },
  { value: "all", label: "All payments" },
  { value: "modify", label: "Modify filter for export" },
]

interface FilterOptions {
  status: string
  merchantId: string
  search: string
}

/**
 * `filterQuery` is the table's filters without `page`, for scope `filter`.
 * Scope `modify` builds its own query from the fields in the dialog, and
 * scope `all` sends none. Each one is counted with the same query builder the
 * export uses, so the number on screen is the number in the file.
 */
export function PaymentsExportButton({
  filterQuery,
  current,
  statuses,
  merchants,
}: {
  filterQuery: string
  current: FilterOptions
  statuses: string[]
  merchants: { id: string; name: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<Scope>("filter")
  const [draft, setDraft] = useState<FilterOptions>(current)
  const [count, setCount] = useState<number | "unavailable" | null>(null)

  const draftQuery = new URLSearchParams()
  if (draft.status && draft.status !== "all") {
    draftQuery.set("status", draft.status)
  }
  if (draft.merchantId) draftQuery.set("merchantId", draft.merchantId)
  if (draft.search.trim()) draftQuery.set("search", draft.search.trim())

  const scopedQuery =
    scope === "all"
      ? ""
      : scope === "modify"
        ? draftQuery.toString()
        : filterQuery

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()

    setCount(null)
    // Typing in the search field changes the query on every keystroke. Wait
    // for a pause before asking the server for a new count.
    const timer = setTimeout(() => {
      fetch(`/api/payments${scopedQuery ? `?${scopedQuery}` : ""}`, {
        signal: controller.signal,
      })
        .then((response) => response.json())
        .then((data: { total: number }) => setCount(data.total))
        .catch(() => {
          if (!controller.signal.aborted) setCount("unavailable")
        })
    }, 250)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [open, scopedQuery])

  const toggle = (column: ExportColumn) => {
    setSelected(
      EXPORT_COLUMNS.filter((c) =>
        c === column ? !selected.includes(c) : selected.includes(c),
      ),
    )
  }

  const exportQuery = new URLSearchParams(scopedQuery)
  exportQuery.set("columns", selected.join(","))
  exportQuery.set("scope", scope === "all" ? "all" : "filter")

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        // Start the modify-filter fields from whatever the table shows now.
        if (next) setDraft(current)
        setOpen(next)
      }}
    >
      <Dialog.Trigger asChild>
        <Button
          variant="secondary"
          className="w-full gap-2 py-1.5 sm:w-fit"
        >
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-gray-950/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-950">
          <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            Export payments
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-gray-500">
            Choose the columns and which payments to include.
          </Dialog.Description>

          <fieldset className="mt-5">
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
                    checked={selected.includes(column)}
                    onChange={() => toggle(column)}
                    className="size-4 rounded border-gray-300 dark:border-gray-700"
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-5">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Payments
            </legend>
            <div className="mt-2 flex flex-col gap-2">
              {SCOPES.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="radio"
                    name="export-scope"
                    value={option.value}
                    checked={scope === option.value}
                    onChange={() => setScope(option.value)}
                    className="size-4 border-gray-300 dark:border-gray-700"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          {scope === "modify" && (
            <fieldset className="mt-5 flex flex-col gap-4 rounded-md border border-gray-200 p-4 dark:border-gray-800">
              <legend className="px-1 text-sm font-medium text-gray-900 dark:text-gray-50">
                Filters
              </legend>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="export-search"
                  className="text-sm text-gray-700 dark:text-gray-300"
                >
                  Search
                </label>
                <Input
                  id="export-search"
                  type="search"
                  name="search"
                  value={draft.search}
                  onChange={(event) =>
                    setDraft({ ...draft, search: event.target.value })
                  }
                  placeholder="Search payments..."
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="export-status"
                  className="text-sm text-gray-700 dark:text-gray-300"
                >
                  Status
                </label>
                <Select
                  value={draft.status || "all"}
                  onValueChange={(status) => setDraft({ ...draft, status })}
                >
                  <SelectTrigger id="export-status" className="w-full py-1.5">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {statuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_LABELS[status] ?? status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="export-merchant"
                  className="text-sm text-gray-700 dark:text-gray-300"
                >
                  Merchant
                </label>
                <Select
                  value={draft.merchantId || "all"}
                  onValueChange={(merchantId) =>
                    setDraft({
                      ...draft,
                      merchantId: merchantId === "all" ? "" : merchantId,
                    })
                  }
                >
                  <SelectTrigger id="export-merchant" className="w-full py-1.5">
                    <SelectValue placeholder="All merchants" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectItem value="all">All merchants</SelectItem>
                    {merchants.map((merchant) => (
                      <SelectItem key={merchant.id} value={merchant.id}>
                        {merchant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </fieldset>
          )}

          <p aria-live="polite" className="mt-5 text-sm text-gray-500">
            {count === null && "Counting payments…"}
            {count === "unavailable" && "Couldn't count payments."}
            {typeof count === "number" &&
              `${count.toLocaleString()} ${count === 1 ? "payment" : "payments"} will be exported.`}
          </p>

          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="secondary" className="py-1.5">
                Cancel
              </Button>
            </Dialog.Close>
            {selected.length === 0 ? (
              <Button variant="primary" className="py-1.5" disabled>
                Download
              </Button>
            ) : (
              <Button variant="primary" className="py-1.5" asChild>
                <a
                  href={`/api/payments/export?${exportQuery.toString()}`}
                  download
                  onClick={() => setOpen(false)}
                >
                  Download
                </a>
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
