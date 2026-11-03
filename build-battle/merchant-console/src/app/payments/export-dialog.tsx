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
  EXPORT_FORMATS,
  ExportColumn,
  ExportFormat,
  exportFilename,
} from "@/lib/csv"
import { cx, focusRing } from "@/lib/utils"
import { Check, Copy, Download } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

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

const SENSITIVE: Partial<Record<ExportColumn, string>> = {
  last4: "Leave off for anything going to a merchant",
}

const STORAGE_KEY = "nwp-export-prefs"

const CONTROL = cx(
  "size-4 shrink-0 rounded border-gray-300 text-blue-500 dark:border-gray-700",
  "bg-white dark:bg-gray-950",
  focusRing,
)

export function ExportOptionsDialog({
  query,
  filteredCount,
  allCount,
  scopeToken,
}: {
  query: string
  filteredCount: number
  allCount: number
  scopeToken: string
}) {
  const [selected, setSelected] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<ExportScope>("filter")
  const [format, setFormat] = useState<ExportFormat>("csv")
  const [preview, setPreview] = useState("")
  const [previewFailed, setPreviewFailed] = useState(false)
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Remember the last choice for this browser session. A column set is a
  // convenience, never data, so it stays out of the store.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (!saved) return
      const parsed = JSON.parse(saved) as {
        columns?: string[]
        format?: string
      }
      const columns = (parsed.columns ?? []).filter((c): c is ExportColumn =>
        (EXPORT_COLUMNS as readonly string[]).includes(c),
      )
      if (columns.length) setSelected(columns)
      if (parsed.format === "json" || parsed.format === "csv") {
        setFormat(parsed.format)
      }
    } catch {
      // a blocked or empty store just means the defaults stand
    }
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ columns: selected, format }),
      )
    } catch {
      // nothing to do: the choice simply will not be remembered
    }
  }, [selected, format])

  const nothingSelected = selected.length === 0
  const rowCount = scope === "all" ? allCount : filteredCount

  // Scope "all" deliberately drops the table's filters, so the URL says what
  // the file holds. The server validates every parameter again regardless.
  const href = useMemo(() => {
    const params = new URLSearchParams(scope === "all" ? "" : query)
    params.delete("page")
    params.set("columns", selected.join(","))
    params.set("format", format)
    if (scope === "all") params.set("scope", "all")
    return `/api/payments/export?${params.toString()}`
  }, [query, scope, selected, format])

  // The same builder the route uses, so the name shown is the name saved.
  const filename = exportFilename(
    new Date(),
    scope === "all" ? "all" : scopeToken,
    format,
  )

  // The preview is the first lines of the real file, fetched from the real
  // route, so it can never drift from what downloads.
  useEffect(() => {
    if (nothingSelected) {
      setPreview("")
      setPreviewFailed(false)
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch(`${href}&preview=1`, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error(String(res.status))
          return res.text()
        })
        .then((text) => {
          setPreview(text)
          setPreviewFailed(false)
        })
        .catch((error) => {
          // An abort is this effect superseding itself, not a failure.
          if (error?.name === "AbortError") return
          setPreview("")
          setPreviewFailed(true)
        })
    }, 120)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [href, nothingSelected])

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current)
    },
    [],
  )

  const toggle = (column: ExportColumn) =>
    setSelected((current) =>
      current.includes(column)
        ? current.filter((name) => name !== column)
        : EXPORT_COLUMNS.filter(
            (name) => name === column || current.includes(name),
          ),
    )

  const copy = async () => {
    try {
      const text = await fetch(href).then((res) => res.text())
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

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

      <DrawerContent className="sm:max-w-lg">
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription className="text-sm">
            Pick the rows, the columns and the format. Card last four is left
            out unless you ask for it.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="space-y-7">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Rows
            </legend>
            <div className="mt-2.5 space-y-2">
              {(
                [
                  ["filter", "Current filter", filteredCount],
                  ["all", "All payments (ignores filters)", allCount],
                ] as const
              ).map(([value, label, count]) => (
                <label
                  key={value}
                  className="flex items-center gap-2.5 text-sm text-gray-900 dark:text-gray-50"
                >
                  <input
                    type="radio"
                    name="scope"
                    value={value}
                    checked={scope === value}
                    onChange={() => setScope(value)}
                    className={cx(CONTROL, "rounded-full")}
                  />
                  <span>{label}</span>
                  <span className="tabular-nums text-gray-500 dark:text-gray-500">
                    {count.toLocaleString()}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Format
            </legend>
            <div className="mt-2.5 inline-flex overflow-hidden rounded-md border border-gray-300 dark:border-gray-800">
              {EXPORT_FORMATS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFormat(value)}
                  aria-pressed={format === value}
                  className={cx(
                    "px-3.5 py-1.5 text-sm uppercase tracking-wide transition-colors",
                    "border-l border-gray-300 first:border-l-0 dark:border-gray-800",
                    format === value
                      ? "bg-gray-900 font-medium text-white dark:bg-gray-50 dark:text-gray-900"
                      : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-950 dark:text-gray-400 dark:hover:bg-gray-900/60",
                    focusRing,
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="-mt-6 flex justify-end">
              <div className="flex gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setSelected([...EXPORT_COLUMNS])}
                  className={cx(
                    "text-blue-600 hover:underline dark:text-blue-500",
                    focusRing,
                  )}
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setSelected([...DEFAULT_EXPORT_COLUMNS])}
                  className={cx(
                    "text-gray-500 hover:underline dark:text-gray-400",
                    focusRing,
                  )}
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setSelected([])}
                  className={cx(
                    "text-gray-500 hover:underline dark:text-gray-400",
                    focusRing,
                  )}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="mt-2.5 grid grid-cols-1 gap-x-5 gap-y-2.5 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  className="flex items-start gap-2.5 text-sm text-gray-900 dark:text-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(column)}
                    onChange={() => toggle(column)}
                    className={cx(CONTROL, "mt-0.5")}
                  />
                  <span>
                    {COLUMN_LABELS[column]}
                    {SENSITIVE[column] && (
                      <span className="block text-xs text-amber-700 dark:text-amber-500">
                        {SENSITIVE[column]}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            {nothingSelected && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-500">
                Pick at least one column to export.
              </p>
            )}
          </fieldset>

          {!nothingSelected && (
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
                Preview
              </p>
              <p className="mt-1 text-xs text-gray-500">
                The first rows of the file itself, straight from the export.
              </p>
              {previewFailed ? (
                <p className="mt-2.5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
                  The preview could not be loaded. The download may fail too —
                  check the column selection and try again.
                </p>
              ) : (
                <pre className="mt-2.5 max-h-40 overflow-auto rounded-md border border-gray-200 bg-gray-50 p-3 text-xs leading-relaxed text-gray-700 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-300">
                  {preview || "Loading the first rows…"}
                </pre>
              )}
            </div>
          )}
        </DrawerBody>

        <DrawerFooter className="items-center">
          <div className="mr-auto text-sm">
            <p className="tabular-nums text-gray-900 dark:text-gray-50">
              {rowCount.toLocaleString()} {rowCount === 1 ? "row" : "rows"} ·{" "}
              {selected.length}{" "}
              {selected.length === 1 ? "column" : "columns"}
            </p>
            {!nothingSelected && (
              <p className="font-mono text-xs text-gray-500">{filename}</p>
            )}
          </div>
          <Button
            variant="secondary"
            className="gap-2"
            onClick={copy}
            disabled={nothingSelected}
          >
            {copied ? (
              <Check className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <Copy className="size-4 shrink-0" aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
          {nothingSelected ? (
            <Button disabled>Download</Button>
          ) : (
            <Button asChild>
              <a href={href} download>
                Download
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
