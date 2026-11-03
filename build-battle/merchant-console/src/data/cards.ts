import { canTransition, generateCardNumber } from "@/lib/cards"
import { store } from "./store"
import { Card, CardStatus, IssueCardInput } from "./types"

/**
 * Card reads and writes against the in-memory store. Input reaching here has
 * already been through `validateIssueInput`; the full card number is never
 * stored, only returned once from `issueCard`.
 */

export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

/**
 * Issues a card. A repeated idempotency key returns the card the first
 * request created, without the number: the reveal happens once.
 */
export function issueCard(
  input: IssueCardInput,
  now = new Date(),
): { card: Card; number: string | null } {
  const { idempotencyKey, ...details } = input

  const existingId = idempotencyKey && store.cardRequests.get(idempotencyKey)
  const existing = existingId ? cardById(existingId) : null
  if (existing) return { card: existing, number: null }

  const number = generateCardNumber()
  const createdAt = now.toISOString()
  const card: Card = {
    ...details,
    id: `crd_${String(store.cards.length + 1).padStart(4, "0")}`,
    last4: number.slice(-4),
    charges: [],
    status: "active",
    createdAt,
    history: [{ from: null, to: "active", at: createdAt }],
  }

  store.cards.push(card)
  if (idempotencyKey) store.cardRequests.set(idempotencyKey, card.id)
  return { card, number }
}

export type TransitionResult =
  | { ok: true; card: Card }
  | { ok: false; reason: "not_found" | "invalid_transition" }

export function transitionCard(
  id: string,
  to: CardStatus,
  now = new Date(),
): TransitionResult {
  const card = cardById(id)
  if (!card) return { ok: false, reason: "not_found" }
  if (!canTransition(card.status, to)) {
    return { ok: false, reason: "invalid_transition" }
  }

  card.history.push({ from: card.status, to, at: now.toISOString() })
  card.status = to
  return { ok: true, card }
}
