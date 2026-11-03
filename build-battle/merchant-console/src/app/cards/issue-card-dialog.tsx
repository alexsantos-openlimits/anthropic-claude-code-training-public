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
import { Input } from "@/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import type { Currency } from "@/data/types"
import { formatMoney } from "@/lib/money"
import { Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

type Field = "nickname" | "merchantId" | "limit" | "currency" | "category"

const FIELD_IDS: Record<Field, string> = {
  nickname: "card-nickname",
  merchantId: "card-merchant",
  limit: "card-limit",
  currency: "card-currency",
  category: "card-category",
}

interface Issued {
  id: string
  nickname: string
  last4: string
  /** Null when the server recognised a repeat and did not reveal again. */
  number: string | null
}

const labelClass = "text-sm font-medium text-gray-900 dark:text-gray-50"
const errorClass = "mt-1 text-sm text-red-600 dark:text-red-500"

export function IssueCardDialog({
  merchants,
  currencies,
  categories,
  maxLimit,
}: {
  merchants: { id: string; name: string; currency: Currency }[]
  currencies: readonly Currency[]
  categories: { value: string; label: string }[]
  /** Integer minor units. */
  maxLimit: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState("")
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [limit, setLimit] = useState("")
  const [category, setCategory] = useState("any")
  const [submitting, setSubmitting] = useState(false)
  // State lags a render behind; the ref stops a same-tick double click from
  // sending a second request whose replayed reply would hide the number.
  const inFlight = useRef(false)
  const [error, setError] = useState<{ field: Field | null; message: string } | null>(null)
  const [issued, setIssued] = useState<Issued | null>(null)
  const [copied, setCopied] = useState(false)

  const merchant = merchants.find((m) => m.id === merchantId)
  const currencyMismatch = merchant !== undefined && merchant.currency !== currency
  const fieldError = (field: Field) =>
    error?.field === field ? error.message : null
  const clearError = (field: Field) =>
    setError((current) => (current?.field === field ? null : current))
  const errorId = (field: Field) => `${FIELD_IDS[field]}-error`
  const fieldA11y = (field: Field, hintId?: string) => ({
    "aria-invalid": !!fieldError(field),
    "aria-describedby":
      [hintId, fieldError(field) ? errorId(field) : undefined]
        .filter(Boolean)
        .join(" ") || undefined,
  })
  const renderError = (field: Field) =>
    fieldError(field) && (
      <p id={errorId(field)} className={errorClass}>
        {fieldError(field)}
      </p>
    )

  // Move focus to the field the server rejected, so its error is announced.
  useEffect(() => {
    if (error?.field) document.getElementById(FIELD_IDS[error.field])?.focus()
  }, [error])

  function reset() {
    setNickname("")
    setMerchantId("")
    setCurrency("USD")
    setLimit("")
    setCategory("any")
    setError(null)
    setIssued(null)
    setCopied(false)
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      setIdempotencyKey(globalThis.crypto.randomUUID())
    } else {
      const refresh = issued !== null
      reset()
      if (refresh) router.refresh()
    }
    setOpen(next)
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          nickname,
          merchantId,
          limit,
          currency,
          category: category === "any" ? null : category,
        }),
      })
      const body = await response.json().catch(() => null)
      if (response.status === 409) router.refresh()
      if (!response.ok || !body?.card) {
        setError({
          field: body?.field ?? null,
          message: body?.error ?? "The card wasn't issued. Try again.",
        })
        return
      }
      setIssued({
        id: body.card.id,
        nickname: body.card.nickname,
        last4: body.card.last4,
        number: typeof body.number === "string" ? body.number : null,
      })
    } catch {
      setError({
        field: null,
        message:
          "Couldn't reach the server, so a card may have been issued. Trying again won't create a second one.",
      })
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  async function copyNumber() {
    if (!issued?.number) return
    try {
      await navigator.clipboard.writeText(issued.number)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>
      <DrawerContent className="sm:max-w-md">
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>{issued.nickname}</DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-4">
              {issued.number ? (
                <>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    This is the only time the full number is shown. Copy it
                    now. After you close this panel, only the last four
                    (•••• {issued.last4}) is kept.
                  </p>
                  <p
                    aria-label="Card number"
                    className="select-all rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-center font-mono text-xl tracking-wider text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50"
                  >
                    {issued.number.match(/.{1,4}/g)?.join(" ")}
                  </p>
                  <Button
                    variant="secondary"
                    className="self-start"
                    onClick={copyNumber}
                  >
                    {copied ? "Copied" : "Copy number"}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  This card was already issued from this form, so its number
                  isn&apos;t shown again. It ends in •••• {issued.last4}.
                </p>
              )}
            </DrawerBody>
            <DrawerFooter className="gap-2">
              <Button variant="secondary" asChild className="w-full sm:w-fit">
                <Link href={`/cards/${issued.id}`} onClick={() => handleOpenChange(false)}>
                  View card
                </Link>
              </Button>
              <DrawerClose asChild>
                <Button className="w-full sm:w-fit">Done</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <>
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                Single-merchant, virtual, with a spend limit from the start.
              </DrawerDescription>
            </DrawerHeader>
            <form onSubmit={submit} noValidate className="flex flex-1 flex-col">
              <DrawerBody className="flex flex-col gap-5">
                <div>
                  <label htmlFor="card-nickname" className={labelClass}>
                    Nickname
                  </label>
                  <Input
                    id="card-nickname"
                    className="mt-2"
                    value={nickname}
                    onChange={(e) => {
                      setNickname(e.target.value)
                      clearError("nickname")
                    }}
                    placeholder="e.g. Figma seats"
                    maxLength={40}
                    hasError={!!fieldError("nickname")}
                    {...fieldA11y("nickname")}
                  />
                  {renderError("nickname")}
                </div>

                <div>
                  <label htmlFor="card-merchant" className={labelClass}>
                    Merchant
                  </label>
                  <Select
                    value={merchantId}
                    onValueChange={(id) => {
                      setMerchantId(id)
                      clearError("merchantId")
                      const chosen = merchants.find((m) => m.id === id)
                      if (chosen) setCurrency(chosen.currency)
                    }}
                  >
                    <SelectTrigger
                      id="card-merchant"
                      className="mt-2"
                      hasError={!!fieldError("merchantId")}
                      {...fieldA11y("merchantId")}
                    >
                      <SelectValue placeholder="Choose a merchant" />
                    </SelectTrigger>
                    <SelectContent>
                      {merchants.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {renderError("merchantId")}
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_7rem]">
                  <div>
                    <label htmlFor="card-limit" className={labelClass}>
                      Spend limit
                    </label>
                    <Input
                      id="card-limit"
                      className="mt-2"
                      inputMode="decimal"
                      value={limit}
                      onChange={(e) => {
                        setLimit(e.target.value)
                        clearError("limit")
                      }}
                      placeholder="250.00"
                      hasError={!!fieldError("limit")}
                      {...fieldA11y("limit", "card-limit-hint")}
                    />
                    <p id="card-limit-hint" className="mt-1 text-xs text-gray-500">
                      Up to {formatMoney(maxLimit, currency)}.
                    </p>
                    {renderError("limit")}
                  </div>
                  <div>
                    <label htmlFor="card-currency" className={labelClass}>
                      Currency
                    </label>
                    <Select
                      value={currency}
                      onValueChange={(code) => {
                        setCurrency(code as Currency)
                        clearError("currency")
                      }}
                    >
                      <SelectTrigger
                        id="card-currency"
                        className="mt-2"
                        hasError={!!fieldError("currency")}
                        {...fieldA11y("currency")}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((code) => (
                          <SelectItem key={code} value={code}>
                            {code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {currencyMismatch && (
                  <p
                    role="status"
                    className="-mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  >
                    {merchant.name} settles in {merchant.currency}. This card
                    will be issued in {currency}.
                  </p>
                )}
                {renderError("currency")}

                <div>
                  <label htmlFor="card-category" className={labelClass}>
                    Merchant category lock
                  </label>
                  <Select
                    value={category}
                    onValueChange={(value) => {
                      setCategory(value)
                      clearError("category")
                    }}
                  >
                    <SelectTrigger
                      id="card-category"
                      className="mt-2"
                      hasError={!!fieldError("category")}
                      {...fieldA11y("category")}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any category</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {renderError("category")}
                </div>

                {error && error.field === null && (
                  <p role="alert" className={errorClass}>
                    {error.message}
                  </p>
                )}
              </DrawerBody>
              <DrawerFooter className="gap-2">
                <DrawerClose asChild>
                  <Button variant="secondary" className="w-full sm:w-fit">
                    Cancel
                  </Button>
                </DrawerClose>
                <Button
                  type="submit"
                  className="w-full sm:w-fit"
                  disabled={submitting}
                  isLoading={submitting}
                  loadingText="Issuing…"
                >
                  Issue card
                </Button>
              </DrawerFooter>
            </form>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}
