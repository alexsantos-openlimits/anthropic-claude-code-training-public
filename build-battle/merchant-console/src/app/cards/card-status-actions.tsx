"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Freeze, unfreeze and cancel. The server enforces the state machine; this
 * only offers the moves that are valid from the current status.
 */
export function CardStatusActions({
  cardId,
  nickname,
  status,
}: {
  cardId: string
  nickname: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === "cancelled") {
    return <span className="text-sm text-gray-500">No actions</span>
  }

  async function change(to: CardStatus) {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: to }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error ?? "The card wasn't updated. Try again.")
      }
      setConfirming(false)
      router.refresh()
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {confirming ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Cancel {nickname}? This can&apos;t be undone.
          </span>
          <Button
            variant="secondary"
            className="py-1"
            disabled={pending}
            onClick={() => setConfirming(false)}
          >
            Keep card
          </Button>
          <Button
            variant="destructive"
            className="py-1"
            disabled={pending}
            onClick={() => change("cancelled")}
          >
            Cancel card
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="py-1"
            disabled={pending}
            aria-label={`${status === "active" ? "Freeze" : "Unfreeze"} ${nickname}`}
            onClick={() => change(status === "active" ? "frozen" : "active")}
          >
            {status === "active" ? "Freeze" : "Unfreeze"}
          </Button>
          <Button
            variant="ghost"
            className="py-1 text-red-600 dark:text-red-500"
            disabled={pending}
            aria-label={`Cancel ${nickname}`}
            onClick={() => setConfirming(true)}
          >
            Cancel
          </Button>
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
