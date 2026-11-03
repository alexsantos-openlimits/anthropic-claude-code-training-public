import { transitionCard } from "@/data/cards"
import { apiError } from "@/lib/api-error"
import { isCardStatus } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/** Moves a card through its state machine. The server is the guard. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, "Send the new status as JSON.", "body")
  }

  const status = (body as { status?: unknown } | null)?.status
  if (!isCardStatus(status)) {
    return apiError(400, "Status must be active, frozen, or cancelled.", "status")
  }

  const result = transitionCard(id, status)
  if (!result.ok) {
    return result.reason === "not_found"
      ? apiError(404, "No card with that id.")
      : apiError(409, "This card cannot move to that status.", "status")
  }
  return NextResponse.json({ card: result.card })
}
