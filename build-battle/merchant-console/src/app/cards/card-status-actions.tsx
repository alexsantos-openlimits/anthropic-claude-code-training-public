"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/** Freeze, unfreeze, and cancel. The server enforces the state machine. */
export function CardStatusActions({
  cardId,
  status,
}: {
  cardId: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, setPending] = useState<CardStatus | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === "cancelled") {
    return (
      <p className="text-sm text-gray-500">
        Cancelled cards cannot be reactivated. Issue a new card instead.
      </p>
    )
  }

  const move = async (to: CardStatus) => {
    setPending(to)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${cardId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: to }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error?.message ?? "The card could not be updated. Try again.")
        return
      }
      setConfirmingCancel(false)
      router.refresh()
    } catch {
      setError("Could not reach the server. Check your connection and try again.")
    } finally {
      setPending(null)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {status === "active" ? (
          <Button
            variant="secondary"
            isLoading={pending === "frozen"}
            disabled={pending !== null}
            onClick={() => move("frozen")}
          >
            Freeze card
          </Button>
        ) : (
          <Button
            variant="secondary"
            isLoading={pending === "active"}
            disabled={pending !== null}
            onClick={() => move("active")}
          >
            Unfreeze card
          </Button>
        )}
        {confirmingCancel ? (
          <>
            <Button
              variant="destructive"
              isLoading={pending === "cancelled"}
              disabled={pending !== null}
              onClick={() => move("cancelled")}
            >
              Yes, cancel permanently
            </Button>
            <Button
              variant="ghost"
              disabled={pending !== null}
              onClick={() => setConfirmingCancel(false)}
            >
              Keep card
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            disabled={pending !== null}
            onClick={() => setConfirmingCancel(true)}
          >
            Cancel card
          </Button>
        )}
      </div>
      {confirmingCancel && (
        <p className="mt-2 text-sm text-gray-500">
          Cancelling is permanent. The card stops working and cannot be unfrozen.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}
