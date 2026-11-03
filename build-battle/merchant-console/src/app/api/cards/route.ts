import { issueCard } from "@/data/cards"
import { maskCardNumber, validateIssueCard } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,100}$/

/**
 * Issues a virtual card. The response to the first request is the only place
 * the full number ever appears. A repeat with the same Idempotency-Key and the
 * same details gets the card back masked; with different details it is a 409.
 */
export async function POST(request: NextRequest) {
  const key = request.headers.get("idempotency-key")
  if (key !== null && !IDEMPOTENCY_KEY.test(key)) {
    return NextResponse.json(
      { error: "The Idempotency-Key header is not valid." },
      { status: 400 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Send the card details as JSON." },
      { status: 400 },
    )
  }

  const result = validateIssueCard(body)
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, field: result.field },
      { status: 400 },
    )
  }

  const issued = issueCard(result.value, key ?? undefined)
  const headers = { "cache-control": "no-store" }
  if (issued.status === "conflict") {
    return NextResponse.json(
      {
        error: `This form already issued a card with different details (${maskCardNumber(issued.card.last4)}). Close it and check that card before issuing another.`,
      },
      { status: 409, headers },
    )
  }
  if (issued.status === "replayed") {
    return NextResponse.json(
      { card: issued.card, replayed: true },
      { status: 200, headers },
    )
  }
  return NextResponse.json(
    { card: issued.card, number: issued.number },
    { status: 201, headers },
  )
}
