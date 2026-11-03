"use client"

import { Button } from "@/components/Button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/Table"
import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { Card, Currency } from "@/data/types"
import { maskedNumber } from "@/lib/cards"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { CreditCard } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { IssueCardDialog, MerchantOption } from "./issue-dialog"

export function CardsTable({
  cards,
  merchants,
}: {
  cards: Card[]
  merchants: MerchantOption[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const name = (id: string) =>
    merchants.find((m) => m.id === id)?.name ?? id

  // Freeze and unfreeze in place: the row updates without a full page load.
  const setStatus = async (id: string, status: "active" | "frozen") => {
    setBusy(id)
    setError(null)
    try {
      const res = await fetch(`/api/cards/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string }
        setError(body.message ?? "That change did not go through.")
        return
      }
      router.refresh()
    } catch {
      setError("That change did not go through. Check your connection.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="flex flex-col justify-between gap-2 px-4 py-6 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            Virtual cards
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {cards.length === 0
              ? "No cards issued yet."
              : `${cards.length.toLocaleString()} ${cards.length === 1 ? "card" : "cards"} issued.`}
          </p>
        </div>
        <IssueCardDialog merchants={merchants} />
      </div>

      {error && (
        <p
          role="alert"
          className="mx-4 mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:mx-6 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
        >
          {error}
        </p>
      )}

      {cards.length === 0 ? (
        <div className="border-t border-gray-200 px-6 py-20 text-center dark:border-gray-800">
          <CreditCard
            className="mx-auto size-8 text-gray-300 dark:text-gray-700"
            aria-hidden="true"
          />
          <p className="mt-3 font-medium text-gray-900 dark:text-gray-50">
            No cards yet
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Issue one and it appears here. Ops no longer has to ask the platform
            team.
          </p>
        </div>
      ) : (
        <TableRoot className="border-t border-gray-200 dark:border-gray-800">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Card</TableHeaderCell>
                <TableHeaderCell>Merchant</TableHeaderCell>
                <TableHeaderCell>Number</TableHeaderCell>
                <TableHeaderCell className="text-right">Limit</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Created</TableHeaderCell>
                <TableHeaderCell>
                  <span className="sr-only">Actions</span>
                </TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cards.map((card) => (
                <TableRow key={card.id}>
                  <TableCell>
                    <Link
                      href={`/cards/${card.id}`}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-500"
                    >
                      {card.nickname}
                    </Link>
                    {card.categoryLock && (
                      <span className="block text-xs text-gray-500">
                        Locked to {card.categoryLock}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{name(card.merchantId)}</TableCell>
                  <TableCell className="tabular-nums text-gray-600 dark:text-gray-400">
                    {maskedNumber(card.last4)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                    {formatMoney(card.limit, card.currency as Currency)}
                  </TableCell>
                  <TableCell>
                    <CardStatusBadge status={card.status} />
                  </TableCell>
                  <TableCell className="tabular-nums text-gray-600 dark:text-gray-400">
                    {formatDate(card.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {card.status === "cancelled" ? (
                      <span className="text-sm text-gray-400">&mdash;</span>
                    ) : (
                      <Button
                        variant="secondary"
                        className="py-1 text-xs"
                        disabled={busy === card.id}
                        onClick={() =>
                          setStatus(
                            card.id,
                            card.status === "active" ? "frozen" : "active",
                          )
                        }
                      >
                        {card.status === "active" ? "Freeze" : "Unfreeze"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableRoot>
      )}
    </>
  )
}
