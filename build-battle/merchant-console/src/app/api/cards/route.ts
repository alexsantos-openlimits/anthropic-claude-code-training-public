import { issueCard, listCards } from "@/data/cards"
import { Currency } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

function isCurrency(value: unknown): value is Currency {
  return (CURRENCIES as readonly unknown[]).includes(value)
}

/** The list never carries a full number: cards hold the last four and nothing else. */
export function GET() {
  return NextResponse.json({ cards: listCards() })
}

/**
 * Issue a card.
 *
 * Everything in the body is from a client, so each field is checked here
 * before it reaches the store. The browser's form validation is a convenience;
 * this is the enforcement.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ message: "Send a JSON body." }, { status: 400 })
  }

  if (!isCurrency(body.currency)) {
    return NextResponse.json(
      { message: "Currency must be USD, EUR or GBP." },
      { status: 400 },
    )
  }

  const result = issueCard({
    nickname: typeof body.nickname === "string" ? body.nickname : "",
    merchantId: typeof body.merchantId === "string" ? body.merchantId : "",
    limit: typeof body.limit === "number" ? body.limit : NaN,
    currency: body.currency,
    categoryLock:
      typeof body.categoryLock === "string" ? body.categoryLock : null,
    idempotencyKey:
      typeof body.idempotencyKey === "string" ? body.idempotencyKey : null,
  })

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status })
  }

  // The only response that ever carries the number, and only for a new card.
  return NextResponse.json(
    { card: result.card, number: result.number, reused: result.reused },
    { status: result.reused ? 200 : 201 },
  )
}
