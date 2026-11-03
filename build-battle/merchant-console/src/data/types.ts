export const CURRENCIES = ["USD", "EUR", "GBP"] as const
export type Currency = (typeof CURRENCIES)[number]

export type PaymentStatus =
  | "authorized"
  | "captured"
  | "refunded"
  | "failed"
  | "disputed"

export type DisputeStatus = "needs_response" | "under_review" | "won" | "lost"

export type PayoutStatus = "paid" | "in_transit" | "pending"

export interface Merchant {
  id: string
  name: string
  country: string
  /** IANA timezone. Display converts to this; storage never does. */
  timezone: string
  currency: Currency
  riskTier: "low" | "standard" | "elevated"
}

export interface Payment {
  id: string
  merchantId: string
  /** Integer minor units. Never a float. */
  amount: number
  currency: Currency
  status: PaymentStatus
  method: "card" | "wallet" | "bank_transfer"
  cardBrand: "visa" | "mastercard" | "amex" | null
  last4: string | null
  /** ISO 8601, always UTC. */
  createdAt: string
  description: string
}

export interface Refund {
  id: string
  paymentId: string
  amount: number
  currency: Currency
  reason: "requested_by_customer" | "duplicate" | "fraudulent"
  createdAt: string
}

export interface Dispute {
  id: string
  paymentId: string
  merchantId: string
  amount: number
  currency: Currency
  reasonCode: string
  status: DisputeStatus
  openedAt: string
  /** Evidence deadline, UTC. */
  evidenceDueAt: string
}

export interface Payout {
  id: string
  merchantId: string
  periodStart: string
  periodEnd: string
  gross: number
  fees: number
  net: number
  currency: Currency
  status: PayoutStatus
  paymentIds: string[]
}

export interface PaymentFilters {
  status?: PaymentStatus | "all"
  merchantId?: string
  search?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
  sort?: "createdAt" | "amount"
  direction?: "asc" | "desc"
}

export type CardStatus = "active" | "frozen" | "cancelled"

/** The merchant category a card is locked to at issue. */
export type CardCategory =
  | "advertising"
  | "software"
  | "travel"
  | "office_supplies"
  | "contractors"

/** A charge on a card. Spend is the sum of these, never a stored total. */
export interface CardCharge {
  description: string
  /** Integer minor units, in the card's currency. */
  amount: number
  /** ISO 8601, always UTC. */
  at: string
}

/** One entry in a card's status history. `from` is null for issue. */
export interface CardEvent {
  from: CardStatus | null
  to: CardStatus
  /** ISO 8601, always UTC. */
  at: string
}

/**
 * A virtual card. There is deliberately no field for the full number:
 * it exists only in the creation response.
 */
export interface Card {
  id: string
  nickname: string
  merchantId: string
  last4: string
  /** Integer minor units. */
  spendLimit: number
  currency: Currency
  category: CardCategory
  status: CardStatus
  /** ISO 8601, always UTC. */
  createdAt: string
  history: CardEvent[]
  charges: CardCharge[]
}

export interface IssueCardInput {
  nickname: string
  merchantId: string
  /** Integer minor units. */
  spendLimit: number
  currency: Currency
  category: CardCategory
  idempotencyKey?: string
}
