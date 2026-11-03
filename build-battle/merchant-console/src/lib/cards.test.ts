import { describe, expect, it } from "vitest"
import {
  canTransition,
  CARD_STATUSES,
  generateCardNumber,
  isCardStatus,
  isLuhnValid,
  lastFour,
  luhnCheckDigit,
  maskedNumber,
  MAX_LIMIT_MINOR,
  TEST_BIN,
} from "./cards"

/**
 * The card rules in `.claude/rules/cards.md` are the ones that make a card
 * look fine while the code is not shippable, so they are pinned here.
 */

describe("generateCardNumber", () => {
  it("always starts on the test BIN, so nothing resembles a real PAN", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCardNumber().startsWith(TEST_BIN)).toBe(true)
    }
  })

  it("is sixteen digits", () => {
    expect(generateCardNumber()).toMatch(/^\d{16}$/)
  })

  it("carries a valid Luhn check digit", () => {
    for (let i = 0; i < 200; i++) {
      expect(isLuhnValid(generateCardNumber())).toBe(true)
    }
  })

  it("is deterministic when the source of randomness is", () => {
    const zeros = () => 0
    expect(generateCardNumber(zeros)).toBe(generateCardNumber(zeros))
    expect(isLuhnValid(generateCardNumber(zeros))).toBe(true)
  })

  it("does not repeat itself across a run", () => {
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) seen.add(generateCardNumber())
    expect(seen.size).toBeGreaterThan(490)
  })
})

describe("luhn", () => {
  it("accepts a known-good number and rejects it one digit off", () => {
    const pan = generateCardNumber()
    expect(isLuhnValid(pan)).toBe(true)
    const broken = pan.slice(0, 15) + String((Number(pan[15]) + 1) % 10)
    expect(isLuhnValid(broken)).toBe(false)
  })

  it("rejects anything that is not digits", () => {
    expect(isLuhnValid("4242-4242-4242-4242")).toBe(false)
    expect(isLuhnValid("")).toBe(false)
  })

  it("returns a single check digit", () => {
    const digit = luhnCheckDigit("424242424242424")
    expect(digit).toBeGreaterThanOrEqual(0)
    expect(digit).toBeLessThanOrEqual(9)
  })
})

describe("masking", () => {
  it("keeps only the last four", () => {
    expect(lastFour("4242424242424242")).toBe("4242")
    expect(maskedNumber("1881")).toBe("•••• 1881")
  })
})

describe("the status machine", () => {
  it("freezes and unfreezes", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("cancels from either live state", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("never comes back from cancelled", () => {
    for (const status of CARD_STATUSES) {
      expect(canTransition("cancelled", status)).toBe(false)
    }
  })

  it("refuses a move to the state it is already in", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })

  it("allowlists the status names a client may send", () => {
    expect(isCardStatus("frozen")).toBe(true)
    expect(isCardStatus("destroyed")).toBe(false)
    expect(isCardStatus("")).toBe(false)
  })
})

describe("limits", () => {
  it("caps at five million minor units, as the ticket states", () => {
    expect(MAX_LIMIT_MINOR).toBe(5_000_000)
  })
})
