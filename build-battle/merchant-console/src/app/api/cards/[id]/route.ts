import { setCardStatus } from "@/data/cards"
import { isCardStatus } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/** Changes a card's status. The state machine is enforced here, not in the UI. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Send the new status as JSON." }, { status: 400 })
  }

  const status = (body as { status?: unknown } | null)?.status
  if (!isCardStatus(status)) {
    return NextResponse.json(
      { error: 'Status must be "active", "frozen", or "cancelled".' },
      { status: 400 },
    )
  }

  const result = setCardStatus(id, status)
  if (!result.ok && result.reason === "not_found") {
    return NextResponse.json({ error: "No card with that id." }, { status: 404 })
  }
  if (!result.ok) {
    const current = result.card?.status
    return NextResponse.json(
      {
        error:
          current === "cancelled"
            ? "This card is cancelled. Cancelled cards can't be changed."
            : `A ${current} card can't be set to ${status}.`,
      },
      { status: 409 },
    )
  }

  return NextResponse.json({ card: result.card })
}
