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
import { Input } from "@/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import { CARD_CATEGORIES } from "@/data/cards"
import { Card, Currency } from "@/data/types"
import { maskedNumber, MAX_LIMIT_MINOR } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { cx, focusRing } from "@/lib/utils"
import { Check, Copy, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"

export type MerchantOption = { id: string; name: string; currency: Currency }

export function IssueCardDialog({ merchants }: { merchants: MerchantOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [categoryLock, setCategoryLock] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [issued, setIssued] = useState<{ card: Card; number: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // One key per attempt, so a double-click issues one card rather than two.
  const idempotencyKey = useRef(crypto.randomUUID())

  const merchant = merchants.find((m) => m.id === merchantId)
  // The card settles through its merchant, so the currency follows it.
  const currency = merchant?.currency ?? null
  const limitMinor = parseAmountToMinorUnits(limit)

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCategoryLock("")
    setError(null)
    setIssued(null)
    setCopied(false)
    idempotencyKey.current = crypto.randomUUID()
  }

  const close = (next: boolean) => {
    setOpen(next)
    // The number lives only on the success screen; closing forgets it.
    if (!next) reset()
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setError(null)

    if (!merchant || limitMinor === null) {
      setError("Pick a merchant and give a spend limit like 2500.00.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname,
          merchantId,
          limit: limitMinor,
          currency: merchant.currency,
          categoryLock: categoryLock || null,
          idempotencyKey: idempotencyKey.current,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        card?: Card
        number?: string | null
        message?: string
      }
      if (!res.ok || !body.card) {
        setError(body.message ?? "The card could not be issued.")
        return
      }
      setIssued({ card: body.card, number: body.number ?? "" })
      router.refresh()
    } catch {
      setError("The card could not be issued. Check your connection.")
    } finally {
      setSubmitting(false)
    }
  }

  const copy = async () => {
    if (!issued?.number) return
    try {
      await navigator.clipboard.writeText(issued.number)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={close}>
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>

      <DrawerContent className="sm:max-w-lg">
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription className="text-sm">
                This is the only time the full number is shown. Copy it now;
                after this it is {maskedNumber(issued.card.last4)} everywhere.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="space-y-5">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-900/50">
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Card number
                </p>
                <p className="mt-2 font-mono text-xl tabular-nums text-gray-900 dark:text-gray-50">
                  {issued.number
                    ? issued.number.replace(/(.{4})/g, "$1 ").trim()
                    : maskedNumber(issued.card.last4)}
                </p>
                {issued.number && (
                  <Button
                    variant="secondary"
                    className="mt-3 gap-2 py-1 text-xs"
                    onClick={copy}
                  >
                    {copied ? (
                      <Check className="size-3.5" aria-hidden="true" />
                    ) : (
                      <Copy className="size-3.5" aria-hidden="true" />
                    )}
                    {copied ? "Copied" : "Copy number"}
                  </Button>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500">Nickname</dt>
                  <dd className="mt-0.5 text-gray-900 dark:text-gray-50">
                    {issued.card.nickname}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Spend limit</dt>
                  <dd className="mt-0.5 tabular-nums text-gray-900 dark:text-gray-50">
                    {formatMoney(issued.card.limit, issued.card.currency)}
                  </dd>
                </div>
              </dl>
            </DrawerBody>
            <DrawerFooter>
              <Button variant="secondary" onClick={() => reset()}>
                Issue another
              </Button>
              <Button onClick={() => close(false)}>Done</Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription className="text-sm">
                Single merchant, virtual, with a limit from the moment it
                exists.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody className="space-y-5">
              <div>
                <label
                  htmlFor="card-nickname"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Ad spend — Q4"
                  className="mt-1.5"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="card-merchant"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select value={merchantId} onValueChange={setMerchantId}>
                  <SelectTrigger id="card-merchant" className="mt-1.5">
                    <SelectValue placeholder="Pick a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} · {m.currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-xs text-gray-500">
                  {merchant
                    ? `${merchant.name} settles in ${merchant.currency}, so this card is ${merchant.currency}.`
                    : "The card takes its merchant's settlement currency."}
                </p>
              </div>

              <div>
                <label
                  htmlFor="card-limit"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Spend limit {currency ? `(${currency})` : ""}
                </label>
                <Input
                  id="card-limit"
                  inputMode="decimal"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  placeholder="2500.00"
                  className="mt-1.5"
                  required
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  {limitMinor !== null && currency
                    ? `${formatMoney(limitMinor, currency)} — stored as ${limitMinor.toLocaleString()} minor units.`
                    : `Up to ${MAX_LIMIT_MINOR.toLocaleString()} minor units.`}
                </p>
              </div>

              <div>
                <label
                  htmlFor="card-category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category lock{" "}
                  <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <Select
                  value={categoryLock}
                  onValueChange={(value) =>
                    setCategoryLock(value === "none" ? "" : value)
                  }
                >
                  <SelectTrigger id="card-category" className="mt-1.5">
                    <SelectValue placeholder="No lock" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No lock</SelectItem>
                    {CARD_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-xs text-gray-500">
                  A locked card only works in that category.
                </p>
              </div>

              {error && (
                <p
                  role="alert"
                  className={cx(
                    "rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700",
                    "dark:border-red-900 dark:bg-red-950/40 dark:text-red-400",
                  )}
                >
                  {error}
                </p>
              )}
            </DrawerBody>

            <DrawerFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => close(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className={cx(focusRing)}
                disabled={submitting}
                isLoading={submitting}
                loadingText="Issuing"
              >
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
