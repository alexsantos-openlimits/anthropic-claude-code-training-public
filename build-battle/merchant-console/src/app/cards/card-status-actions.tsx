"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/** Posts a status change; the server enforces the state machine. */
function useCardStatus(cardId: string) {
  const router = useRouter()
  const [pending, setPending] = useState<CardStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const move = async (to: CardStatus): Promise<boolean> => {
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
        return false
      }
      router.refresh()
      return true
    } catch {
      setError("Could not reach the server. Check your connection and try again.")
      return false
    } finally {
      setPending(null)
    }
  }

  return { pending, error, move }
}

/** Freeze or unfreeze from a list row, without leaving the page. */
export function CardFreezeToggle({
  cardId,
  nickname,
  status,
}: {
  cardId: string
  nickname: string
  status: CardStatus
}) {
  const { pending, error, move } = useCardStatus(cardId)
  if (status === "cancelled") return null

  const to = status === "active" ? "frozen" : "active"
  return (
    <div>
      <Button
        variant="secondary"
        className="py-1"
        isLoading={pending !== null}
        aria-label={`${to === "frozen" ? "Freeze" : "Unfreeze"} ${nickname}`}
        onClick={() => move(to)}
      >
        {to === "frozen" ? "Freeze" : "Unfreeze"}
      </Button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}

/** Freeze, unfreeze, and cancel on the card detail page. */
export function CardStatusActions({
  cardId,
  status,
}: {
  cardId: string
  status: CardStatus
}) {
  const { pending, error, move } = useCardStatus(cardId)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  if (status === "cancelled") {
    return (
      <p className="text-sm text-gray-500">
        Cancelled cards cannot be reactivated. Issue a new card instead.
      </p>
    )
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
              onClick={async () => {
                if (await move("cancelled")) setConfirmingCancel(false)
              }}
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
