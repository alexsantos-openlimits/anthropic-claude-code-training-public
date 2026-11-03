import { cardById, transitionCard } from "@/data/cards"
import { isCardStatus } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ message: "No such card." }, { status: 404 })
  }
  return NextResponse.json({ card })
}

/** Change a card's status. The transition table is the authority, not the caller. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ message: "Send a JSON body." }, { status: 400 })
  }

  const status = body.status
  if (typeof status !== "string" || !isCardStatus(status)) {
    return NextResponse.json(
      { message: "Status must be active, frozen or cancelled." },
      { status: 400 },
    )
  }

  const result = transitionCard(id, status)
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status })
  }
  return NextResponse.json({ card: result.card })
}
