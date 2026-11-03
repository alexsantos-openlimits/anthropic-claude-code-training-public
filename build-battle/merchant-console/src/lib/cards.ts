import { CardStatus } from "@/data/types"

/**
 * Virtual card primitives: number generation, masking, and the status machine.
 *
 * Pure on purpose. Nothing here reads the store or a request, so it tests
 * without a DOM and the rules in `.claude/rules/cards.md` live in one place.
 */

/** The test BIN. Every generated number starts here, so nothing resembles a real PAN. */
export const TEST_BIN = "4242"

const PAN_LENGTH = 16

/** Sum a candidate under the Luhn algorithm. A valid number sums to 0 mod 10. */
export function luhnSum(digits: string): number {
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let value = digits.charCodeAt(i) - 48
    if (double) {
      value *= 2
      if (value > 9) value -= 9
    }
    sum += value
    double = !double
  }
  return sum % 10
}

export function isLuhnValid(pan: string): boolean {
  return /^\d+$/.test(pan) && luhnSum(pan) === 0
}

/** The check digit that makes `body` Luhn-valid. */
export function luhnCheckDigit(body: string): number {
  return (10 - luhnSum(body + "0")) % 10
}

/**
 * A 16-digit number on the test BIN with a valid check digit.
 *
 * `random` is injectable so tests are deterministic; it is never called in the
 * browser, because a number generated client-side is a bug (`cards.md`).
 */
export function generateCardNumber(random: () => number = Math.random): string {
  let body = TEST_BIN
  while (body.length < PAN_LENGTH - 1) {
    body += Math.floor(random() * 10).toString()
  }
  return body + luhnCheckDigit(body).toString()
}

export function lastFour(pan: string): string {
  return pan.slice(-4)
}

/** How a card is shown anywhere but the one-time reveal. */
export function maskedNumber(last4: string): string {
  return `•••• ${last4}`
}

/** Every transition the server will allow. `cancelled` is absent: it is terminal. */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export const CARD_STATUSES = Object.keys(TRANSITIONS) as CardStatus[]

export function isCardStatus(value: string): value is CardStatus {
  return (CARD_STATUSES as readonly string[]).includes(value)
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

/** The limit a card may carry, in minor units. */
export const MIN_LIMIT_MINOR = 1
export const MAX_LIMIT_MINOR = 5_000_000
