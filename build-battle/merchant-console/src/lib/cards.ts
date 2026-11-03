import { merchantById } from "@/data/merchants"
import {
  CardCategory,
  CardEvent,
  CardStatus,
  Currency,
} from "@/data/types"
import { formatMoney, parseAmountToMinorUnits } from "./money"

/**
 * Virtual card rules. Numbers use the 4242 test BIN with a Luhn check digit,
 * are generated on the server, and are shown exactly once: in the creation
 * response. Everything stored or rendered afterwards carries the last four.
 */

export const CARD_BIN = "4242"
export const CARD_NUMBER_LENGTH = 16
/** 5,000,000 minor units: 50,000.00 in any of the card currencies. */
export const MAX_CARD_LIMIT = 5_000_000

export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

export const CARD_CATEGORIES: readonly CardCategory[] = [
  "software",
  "advertising",
  "contractors",
  "travel",
]

export const CATEGORY_LABELS: Record<CardCategory, string> = {
  software: "Software subscriptions",
  advertising: "Advertising",
  contractors: "Contractor tools",
  travel: "Travel",
}

const NICKNAME_MAX = 40

/** Check digit for a number written without one. */
export function luhnCheckDigit(partial: string): number {
  let sum = 0
  for (let i = 0; i < partial.length; i++) {
    let digit = Number(partial[partial.length - 1 - i])
    if (i % 2 === 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return (10 - (sum % 10)) % 10
}

export function isValidLuhn(number: string): boolean {
  if (!/^\d{2,}$/.test(number)) return false
  return luhnCheckDigit(number.slice(0, -1)) === Number(number.slice(-1))
}

/** Uniform 0–9 from the platform CSPRNG; rejection sampling avoids modulo bias. */
function secureDigit(): number {
  const buffer = new Uint8Array(1)
  for (;;) {
    globalThis.crypto.getRandomValues(buffer)
    if (buffer[0] < 250) return buffer[0] % 10
  }
}

/** Server only. The result is returned once and never stored. */
export function generateCardNumber(randomDigit: () => number = secureDigit) {
  let body = CARD_BIN
  while (body.length < CARD_NUMBER_LENGTH - 1) body += String(randomDigit())
  return body + String(luhnCheckDigit(body))
}

export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function eventForTransition(to: CardStatus): CardEvent["type"] {
  if (to === "frozen") return "frozen"
  if (to === "cancelled") return "cancelled"
  return "unfrozen"
}

export function isCardStatus(value: unknown): value is CardStatus {
  return value === "active" || value === "frozen" || value === "cancelled"
}

export interface IssueCardInput {
  nickname: string
  merchantId: string
  limit: number
  currency: Currency
  category: CardCategory | null
}

export type IssueCardField =
  | "nickname"
  | "merchantId"
  | "limit"
  | "currency"
  | "category"

export type IssueCardValidation =
  | { ok: true; value: IssueCardInput }
  | { ok: false; field: IssueCardField | null; error: string }

const fail = (
  field: IssueCardField | null,
  error: string,
): IssueCardValidation => ({ ok: false, field, error })

/**
 * Server-side check of an issue request. The limit arrives as the text ops
 * typed ("250.00") and is converted to minor units here, once.
 */
export function validateIssueCard(input: unknown): IssueCardValidation {
  if (typeof input !== "object" || input === null) {
    return fail(null, "Send the card details as a JSON object.")
  }
  const raw = input as Record<string, unknown>

  const merchantId = typeof raw.merchantId === "string" ? raw.merchantId : ""
  if (!merchantId || !merchantById(merchantId)) {
    return fail("merchantId", "Choose a merchant for this card.")
  }

  const nickname = typeof raw.nickname === "string" ? raw.nickname.trim() : ""
  if (!nickname) return fail("nickname", "Give the card a nickname.")
  if (nickname.length > NICKNAME_MAX) {
    return fail("nickname", `Keep the nickname to ${NICKNAME_MAX} characters.`)
  }

  const currency = raw.currency
  if (!CARD_CURRENCIES.includes(currency as Currency)) {
    return fail("currency", "Choose USD, EUR, or GBP.")
  }

  const limitText = typeof raw.limit === "string" ? raw.limit.trim() : ""
  if (limitText.startsWith("-")) {
    return fail("limit", "The spend limit must be more than zero.")
  }
  const limit = parseAmountToMinorUnits(limitText)
  if (limit === null) {
    return fail("limit", "Enter the spend limit as an amount, like 250.00.")
  }
  if (limit <= 0) {
    return fail("limit", "The spend limit must be more than zero.")
  }
  if (limit > MAX_CARD_LIMIT) {
    return fail(
      "limit",
      `The spend limit can't be more than ${formatMoney(MAX_CARD_LIMIT, currency as Currency)}.`,
    )
  }

  const rawCategory = raw.category
  let category: CardCategory | null = null
  if (rawCategory !== undefined && rawCategory !== null && rawCategory !== "") {
    if (!CARD_CATEGORIES.includes(rawCategory as CardCategory)) {
      return fail("category", "Choose a category from the list.")
    }
    category = rawCategory as CardCategory
  }

  return {
    ok: true,
    value: {
      nickname,
      merchantId,
      limit,
      currency: currency as Currency,
      category,
    },
  }
}
