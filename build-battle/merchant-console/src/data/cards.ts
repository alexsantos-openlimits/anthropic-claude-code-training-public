import {
  IssueCardInput,
  canTransition,
  eventForTransition,
  generateCardNumber,
} from "@/lib/cards"
import { store } from "./store"
import { Card, CardStatus } from "./types"

/** Newest first. */
export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

export type IssueResult =
  | { status: "created"; card: Card; number: string }
  | { status: "replayed"; card: Card }
  | { status: "conflict"; card: Card }

const fingerprint = (input: IssueCardInput) =>
  JSON.stringify([
    input.nickname,
    input.merchantId,
    input.limit,
    input.currency,
    input.category,
  ])

/**
 * Issue a card. The full number is returned here and nowhere else: only the
 * last four is kept. A repeated idempotency key with the same details replays
 * the card without its number; with different details it is a conflict, so a
 * retry after editing the limit cannot silently hand back the old card.
 */
export function issueCard(
  input: IssueCardInput,
  idempotencyKey?: string,
): IssueResult {
  const previous = idempotencyKey
    ? store.cardIdempotency.get(idempotencyKey)
    : undefined
  const existing = previous ? cardById(previous.cardId) : null
  if (previous && existing) {
    return previous.fingerprint === fingerprint(input)
      ? { status: "replayed", card: existing }
      : { status: "conflict", card: existing }
  }

  const number = generateCardNumber()
  const now = new Date().toISOString()
  const card: Card = {
    id: `card_${String(store.cards.length + 1).padStart(4, "0")}`,
    nickname: input.nickname,
    merchantId: input.merchantId,
    last4: number.slice(-4),
    panReference: `pan_ref_${globalThis.crypto.randomUUID()}`,
    limit: input.limit,
    spent: 0,
    currency: input.currency,
    status: "active",
    category: input.category,
    createdAt: now,
    events: [{ type: "issued", at: now }],
  }

  store.cards.push(card)
  if (idempotencyKey) {
    store.cardIdempotency.set(idempotencyKey, {
      cardId: card.id,
      fingerprint: fingerprint(input),
    })
  }
  return { status: "created", card, number }
}

export type StatusChange =
  | { ok: true; card: Card }
  | { ok: false; reason: "not_found" | "not_allowed"; card: Card | null }

/** The server-side guard on the card state machine. */
export function setCardStatus(id: string, to: CardStatus): StatusChange {
  const card = cardById(id)
  if (!card) return { ok: false, reason: "not_found", card: null }
  if (!canTransition(card.status, to)) {
    return { ok: false, reason: "not_allowed", card }
  }

  card.status = to
  card.events.push({ type: eventForTransition(to), at: new Date().toISOString() })
  return { ok: true, card }
}
