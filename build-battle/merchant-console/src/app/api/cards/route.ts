import { issueCard, listCards } from "@/data/cards"
import { apiError } from "@/lib/api-error"
import { validateIssueInput } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

export function GET() {
  return NextResponse.json({ cards: listCards() })
}

/**
 * Issues a card. This is the only response that ever carries the full
 * card number; every other route returns the last four only.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, "Send the card details as JSON.", "body")
  }

  const result = validateIssueInput(body)
  if (!result.ok) return apiError(400, result.message, result.field)

  const { card, number } = issueCard(result.value)
  // A replayed request gets the card it already created, without the number.
  if (!number) return NextResponse.json({ card })
  return NextResponse.json({ card, number }, { status: 201 })
}
