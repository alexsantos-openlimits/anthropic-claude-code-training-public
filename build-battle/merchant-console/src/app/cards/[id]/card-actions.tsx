"use client"

import { Button } from "@/components/Button"
import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/** Freeze, unfreeze and cancel. Cancel is terminal, so it asks first. */
export function CardActions({
  id,
  status,
}: {
  id: string
  status: CardStatus
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const move = async (next: CardStatus) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/cards/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string }
        setError(body.message ?? "That change did not go through.")
        return
      }
      setConfirming(false)
      router.refresh()
    } catch {
      setError("That change did not go through. Check your connection.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex items-center gap-3">
        <CardStatusBadge status={status} />
        {status !== "cancelled" && (
          <>
            <Button
              variant="secondary"
              className="py-1.5"
              disabled={busy}
              onClick={() => move(status === "active" ? "frozen" : "active")}
            >
              {status === "active" ? "Freeze" : "Unfreeze"}
            </Button>
            <Button
              variant="destructive"
              className="py-1.5"
              disabled={busy}
              onClick={() => setConfirming(true)}
            >
              Cancel card
            </Button>
          </>
        )}
      </div>

      {confirming && (
        <div className="rounded-md border border-gray-200 bg-white p-3 text-sm shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <p className="text-gray-900 dark:text-gray-50">
            Cancel this card for good?
          </p>
          <p className="mt-0.5 text-gray-500">
            A cancelled card cannot be reactivated.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              variant="secondary"
              className="py-1 text-xs"
              onClick={() => setConfirming(false)}
            >
              Keep it
            </Button>
            <Button
              variant="destructive"
              className="py-1 text-xs"
              disabled={busy}
              onClick={() => move("cancelled")}
            >
              Yes, cancel it
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}
