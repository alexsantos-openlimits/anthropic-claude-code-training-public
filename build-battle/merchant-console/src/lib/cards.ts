import { merchantById } from "@/data/merchants"
import {
  Card,
  CardCategory,
  CardStatus,
  CURRENCIES,
  Currency,
  IssueCardInput,
} from "@/data/types"
import { formatMoney, sumMinorUnits } from "./money"

/**
 * Card rules. Every generated number is on the 4242 test BIN with a valid
 * Luhn check digit, so nothing here can resemble a real card.
 */

export const CARD_BIN = "4242"
const CARD_LENGTH = 16

export const MAX_SPEND_LIMIT = 5_000_000
export const NICKNAME_MAX_LENGTH = 60

/** The digit that makes `partial + digit` pass the Luhn check. */
export function luhnCheckDigit(partial: string): string {
  let sum = 0
  // Walk right to left; the check digit will sit to the right, so the
  // rightmost digit of `partial` is the first one doubled.
  for (let i = 0; i < partial.length; i++) {
    let digit = Number(partial[partial.length - 1 - i])
    if (i % 2 === 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return String((10 - (sum % 10)) % 10)
}

export function isValidLuhn(number: string): boolean {
  if (!/^\d{2,}$/.test(number)) return false
  return luhnCheckDigit(number.slice(0, -1)) === number.slice(-1)
}

/** A 16-digit number on the test BIN. Server-side only. */
export function generateCardNumber(random: () => number = Math.random): string {
  let body = CARD_BIN
  while (body.length < CARD_LENGTH - 1) {
    body += String(Math.floor(random() * 10))
  }
  return body + luhnCheckDigit(body)
}

export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

/** Spend is derived from the card's charges, all in the card's currency. */
export function cardSpend(card: Pick<Card, "charges">): number {
  return sumMinorUnits(card.charges.map((charge) => charge.amount))
}

export const CARD_CATEGORIES: Record<CardCategory, string> = {
  advertising: "Advertising",
  software: "Software and SaaS",
  travel: "Travel",
  office_supplies: "Office supplies",
  contractors: "Contractor services",
}

function isCardCategory(value: unknown): value is CardCategory {
  return typeof value === "string" && Object.hasOwn(CARD_CATEGORIES, value)
}

/** `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export const CARD_STATUSES = Object.keys(TRANSITIONS) as CardStatus[]

export function isCardStatus(value: unknown): value is CardStatus {
  return CARD_STATUSES.includes(value as CardStatus)
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export type ValidationResult =
  | { ok: true; value: IssueCardInput }
  | { ok: false; field: string; message: string }

/** Checks an issue request from the client. Nothing in it is trusted. */
export function validateIssueInput(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, field: "body", message: "Send the card details as JSON." }
  }
  const input = body as Record<string, unknown>

  const nickname =
    typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (nickname.length === 0 || nickname.length > NICKNAME_MAX_LENGTH) {
    return {
      ok: false,
      field: "nickname",
      message: `Give the card a nickname of 1 to ${NICKNAME_MAX_LENGTH} characters.`,
    }
  }

  const merchantId = typeof input.merchantId === "string" ? input.merchantId : ""
  const merchant = merchantById(merchantId)
  if (!merchant) {
    return { ok: false, field: "merchantId", message: "Choose a merchant." }
  }

  if (!CURRENCIES.includes(input.currency as Currency)) {
    return {
      ok: false,
      field: "currency",
      message: `Currency must be one of ${CURRENCIES.join(", ")}.`,
    }
  }

  const currency = input.currency as Currency
  if (currency !== merchant.currency) {
    return {
      ok: false,
      field: "currency",
      message: `${merchant.name} settles in ${merchant.currency}. The card must use the same currency.`,
    }
  }

  const spendLimit = input.spendLimit
  if (
    typeof spendLimit !== "number" ||
    !Number.isInteger(spendLimit) ||
    spendLimit <= 0 ||
    spendLimit > MAX_SPEND_LIMIT
  ) {
    return {
      ok: false,
      field: "spendLimit",
      message: `Set a spend limit above zero and no more than ${formatMoney(MAX_SPEND_LIMIT, currency)}.`,
    }
  }

  if (!isCardCategory(input.category)) {
    return { ok: false, field: "category", message: "Choose a merchant category." }
  }

  const key = input.idempotencyKey
  if (key !== undefined && (typeof key !== "string" || key.length === 0 || key.length > 100)) {
    return { ok: false, field: "idempotencyKey", message: "Invalid request key." }
  }

  return {
    ok: true,
    value: {
      nickname,
      merchantId,
      spendLimit,
      currency,
      category: input.category,
      idempotencyKey: key,
    },
  }
}
