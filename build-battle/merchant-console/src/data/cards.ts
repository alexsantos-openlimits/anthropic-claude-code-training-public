import {
  canTransition,
  generateCardNumber,
  lastFour,
  MAX_LIMIT_MINOR,
  MIN_LIMIT_MINOR,
} from "@/lib/cards"
import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardEvent, CardStatus, Currency } from "./types"

/**
 * Card lookups and writes. The one place cards are read from or added to the
 * store, so the routes never reach for `store.cards` themselves.
 */

/** Issued cards, newest first. */
export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

/**
 * Issue categories a card may be locked to. A lock is a closed set by
 * definition, so it is allowlisted like every other client value.
 */
export const CARD_CATEGORIES = [
  "Advertising",
  "Software",
  "Travel",
  "Contractors",
  "Shipping",
  "Office",
] as const

export type CardCategory = (typeof CARD_CATEGORIES)[number]

export function isCardCategory(value: string): value is CardCategory {
  return (CARD_CATEGORIES as readonly string[]).includes(value)
}

export type IssueInput = {
  nickname: string
  merchantId: string
  limit: number
  currency: Currency
  categoryLock?: string | null
  idempotencyKey?: string | null
}

export type IssueResult =
  | { ok: true; card: Card; number: string | null; reused: boolean }
  | { ok: false; status: number; message: string }

function nextId(): string {
  return `card_${String(store.cards.length + 1).padStart(4, "0")}`
}

/** An id with no relationship to the card number's digits. */
function randomReference(): string {
  return Array.from({ length: 12 }, () =>
    "abcdefghjkmnpqrstuvwxyz23456789".charAt(Math.floor(Math.random() * 31)),
  ).join("")
}

/**
 * Issue a card.
 *
 * Every rejection is a 400 with a message safe to show a user, and nothing is
 * written until all of them pass. The generated number is returned exactly
 * once, here: the card itself only ever carries the last four.
 */
export function issueCard(input: IssueInput): IssueResult {
  const key = input.idempotencyKey?.trim().slice(0, 100)
  if (key) {
    const existing = store.issuedKeys[key]
    if (existing) {
      const card = cardById(existing)
      // Clicking twice issues one card, and the second answer carries no number.
      if (card) return { ok: true, card, number: null, reused: true }
    }
  }

  const nickname = input.nickname?.trim()
  if (!nickname) {
    return { ok: false, status: 400, message: "Give the card a nickname." }
  }
  if (nickname.length > 60) {
    return {
      ok: false,
      status: 400,
      message: "Keep the nickname under 60 characters.",
    }
  }

  const categoryLock = input.categoryLock?.trim() || null
  if (categoryLock !== null && !isCardCategory(categoryLock)) {
    return {
      ok: false,
      status: 400,
      message: `Category must be one of ${CARD_CATEGORIES.join(", ")}.`,
    }
  }

  const merchant = merchantById(input.merchantId)
  if (!merchant) {
    return { ok: false, status: 400, message: "Pick a merchant for this card." }
  }

  if (!Number.isInteger(input.limit)) {
    return {
      ok: false,
      status: 400,
      message: "The spend limit must be a whole number of minor units.",
    }
  }
  if (input.limit < MIN_LIMIT_MINOR) {
    return { ok: false, status: 400, message: "The spend limit must be above zero." }
  }
  if (input.limit > MAX_LIMIT_MINOR) {
    return {
      ok: false,
      status: 400,
      message: "The spend limit cannot be above 5,000,000 minor units.",
    }
  }

  // A card settles through its merchant, so it cannot carry another currency.
  if (input.currency !== merchant.currency) {
    return {
      ok: false,
      status: 400,
      message: `${merchant.name} settles in ${merchant.currency}, so this card must be ${merchant.currency}.`,
    }
  }

  const pan = generateCardNumber()
  const now = new Date().toISOString()
  const card: Card = {
    id: nextId(),
    nickname,
    merchantId: merchant.id,
    limit: input.limit,
    currency: merchant.currency,
    status: "active",
    last4: lastFour(pan),
    // Opaque on purpose. A reference derived from the digits would, with the
    // public BIN and the last four, rebuild the whole number from a list
    // payload — which is exactly what ORG-STANDARDS #8 forbids.
    reference: `ref_${randomReference()}`,
    categoryLock,
    spent: 0,
    createdAt: now,
    events: [{ at: now, action: "issued", from: null, to: "active" }],
  }

  store.cards.push(card)
  if (key) store.issuedKeys[key] = card.id

  return { ok: true, card, number: pan, reused: false }
}

const ACTION: Record<CardStatus, CardEvent["action"]> = {
  active: "unfrozen",
  frozen: "frozen",
  cancelled: "cancelled",
}

export type TransitionResult =
  | { ok: true; card: Card }
  | { ok: false; status: number; message: string }

/** Move a card's status, guarded on the server rather than only in the UI. */
export function transitionCard(id: string, to: CardStatus): TransitionResult {
  const card = cardById(id)
  if (!card) return { ok: false, status: 404, message: "No such card." }

  if (!canTransition(card.status, to)) {
    const why =
      card.status === "cancelled"
        ? "A cancelled card is cancelled for good."
        : `A ${card.status} card cannot become ${to}.`
    return { ok: false, status: 409, message: why }
  }

  const from = card.status
  card.status = to
  card.events.push({
    at: new Date().toISOString(),
    action: ACTION[to],
    from,
    to,
  })
  return { ok: true, card }
}
