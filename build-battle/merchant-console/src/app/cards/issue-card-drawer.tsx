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
import { Card, CardCategory, CURRENCIES, Currency } from "@/data/types"
import { CARD_CATEGORIES, maskCardNumber, NICKNAME_MAX_LENGTH } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useRef, useState } from "react"

type Field = "nickname" | "merchantId" | "spendLimit" | "currency" | "category"
type Errors = Partial<Record<Field, string>>

const FIELDS: readonly string[] = [
  "nickname",
  "merchantId",
  "spendLimit",
  "currency",
  "category",
]

const labelClass = "text-sm font-medium text-gray-900 dark:text-gray-50"
const errorClass = "mt-1 text-sm text-red-600 dark:text-red-500"

export function IssueCardDrawer({
  merchants,
}: {
  merchants: { id: string; name: string; currency: Currency }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [currency, setCurrency] = useState<Currency | "">("")
  const [limit, setLimit] = useState("")
  const [category, setCategory] = useState<CardCategory | "">("")
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  // The one place the full number lives on the client. Cleared on close.
  const [issued, setIssued] = useState<{ card: Card; number: string | null } | null>(null)
  // One key per opening of the drawer: a double submit reuses it, and the
  // server hands back the card it already created instead of a second one.
  const requestKey = useRef("")

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      requestKey.current = crypto.randomUUID()
      return
    }
    setNickname("")
    setMerchantId("")
    setCurrency("")
    setLimit("")
    setCategory("")
    setErrors({})
    setFormError(null)
    setIssued(null)
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending) return

    const spendLimit = parseAmountToMinorUnits(limit)
    if (spendLimit === null) {
      setErrors({ spendLimit: "Enter an amount like 250 or 250.00." })
      return
    }

    setPending(true)
    setErrors({})
    setFormError(null)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname,
          merchantId,
          spendLimit,
          currency,
          category,
          idempotencyKey: requestKey.current,
        }),
      })
      const body = await response.json()
      if (!response.ok) {
        const { message, field } = body.error ?? {}
        if (FIELDS.includes(field)) setErrors({ [field as Field]: message })
        else setFormError(message ?? "The card could not be issued. Try again.")
        return
      }
      setIssued({ card: body.card, number: body.number ?? null })
      router.refresh()
    } catch {
      setFormError("Could not reach the server. Check your connection and try again.")
    } finally {
      setPending(false)
    }
  }

  const describedBy = (field: Field) =>
    errors[field] ? `issue-${field}-error` : undefined

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                {issued.card.nickname} ·{" "}
                {formatMoney(issued.card.spendLimit, issued.card.currency)} limit
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody>
              {issued.number ? (
                <>
                  <p className="text-sm text-gray-500">Card number</p>
                  <p className="mt-1 font-mono text-xl tabular-nums text-gray-900 dark:text-gray-50">
                    {issued.number.replace(/(\d{4})(?=\d)/g, "$1 ")}
                  </p>
                  <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    This is the only time the full number is shown. Copy it now; afterwards
                    the console shows {maskCardNumber(issued.card.last4)}.
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-900 dark:text-gray-50">
                  This request already issued {maskCardNumber(issued.card.last4)}. Its full
                  number was shown when it was created and cannot be shown again.
                </p>
              )}
            </DrawerBody>
            <DrawerFooter>
              <Button variant="secondary" asChild>
                <Link href={`/cards/${issued.card.id}`}>View card</Link>
              </Button>
              <DrawerClose asChild>
                <Button>Done</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                Single-merchant and virtual, with a spend limit from the start.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="space-y-5">
              <div>
                <label htmlFor="issue-nickname" className={labelClass}>
                  Nickname
                </label>
                <Input
                  id="issue-nickname"
                  className="mt-2"
                  value={nickname}
                  maxLength={NICKNAME_MAX_LENGTH}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="Ad spend, Q4"
                  hasError={Boolean(errors.nickname)}
                  aria-invalid={Boolean(errors.nickname)}
                  aria-describedby={describedBy("nickname")}
                  required
                />
                {errors.nickname && (
                  <p id="issue-nickname-error" className={errorClass}>
                    {errors.nickname}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="issue-merchant" className={labelClass}>
                  Merchant
                </label>
                <Select
                  value={merchantId}
                  onValueChange={(id) => {
                    setMerchantId(id)
                    const merchant = merchants.find((m) => m.id === id)
                    if (merchant) setCurrency(merchant.currency)
                  }}
                >
                  <SelectTrigger
                    id="issue-merchant"
                    className="mt-2"
                    hasError={Boolean(errors.merchantId)}
                    aria-invalid={Boolean(errors.merchantId)}
                    aria-describedby={describedBy("merchantId")}
                  >
                    <SelectValue placeholder="Choose a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((merchant) => (
                      <SelectItem key={merchant.id} value={merchant.id}>
                        {merchant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.merchantId && (
                  <p id="issue-merchantId-error" className={errorClass}>
                    {errors.merchantId}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label htmlFor="issue-limit" className={labelClass}>
                    Spend limit
                  </label>
                  <Input
                    id="issue-limit"
                    className="mt-2"
                    inputMode="decimal"
                    value={limit}
                    onChange={(event) => setLimit(event.target.value)}
                    placeholder="250.00"
                    hasError={Boolean(errors.spendLimit)}
                    aria-invalid={Boolean(errors.spendLimit)}
                    aria-describedby={describedBy("spendLimit")}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="issue-currency" className={labelClass}>
                    Currency
                  </label>
                  <Select
                    value={currency}
                    onValueChange={(value) => setCurrency(value as Currency)}
                  >
                    <SelectTrigger
                      id="issue-currency"
                      className="mt-2"
                      hasError={Boolean(errors.currency)}
                      aria-invalid={Boolean(errors.currency)}
                      aria-describedby={describedBy("currency")}
                    >
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {errors.spendLimit && (
                <p id="issue-spendLimit-error" className={errorClass}>
                  {errors.spendLimit}
                </p>
              )}
              {errors.currency && (
                <p id="issue-currency-error" className={errorClass}>
                  {errors.currency}
                </p>
              )}

              <div>
                <label htmlFor="issue-category" className={labelClass}>
                  Merchant category
                </label>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as CardCategory)}
                >
                  <SelectTrigger
                    id="issue-category"
                    className="mt-2"
                    hasError={Boolean(errors.category)}
                    aria-invalid={Boolean(errors.category)}
                    aria-describedby={describedBy("category")}
                  >
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CARD_CATEGORIES).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p
                  id="issue-category-error"
                  className={errors.category ? errorClass : "mt-1 text-sm text-gray-500"}
                >
                  {errors.category ?? "The card only works at merchants in this category."}
                </p>
              </div>

              {formError && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-500">
                  {formError}
                </p>
              )}
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DrawerClose>
              <Button type="submit" disabled={pending} isLoading={pending}>
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
