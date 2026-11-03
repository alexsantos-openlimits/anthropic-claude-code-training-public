import { describe, expect, it } from "vitest"
import { CardStatus } from "@/data/types"
import {
  canTransition,
  generateCardNumber,
  isValidLuhn,
  luhnCheckDigit,
  maskCardNumber,
  validateIssueCard,
} from "./cards"

/**
 * Card numbers are the one value in this app that must never look real and
 * never be shown twice. These pin the test BIN, the check digit, and the
 * state machine the server enforces.
 */

describe("luhnCheckDigit", () => {
  it("matches the published 4242 test number", () => {
    expect(luhnCheckDigit("424242424242424")).toBe(2)
    expect(isValidLuhn("4242424242424242")).toBe(true)
  })

  it("rejects a number with a wrong check digit", () => {
    expect(isValidLuhn("4242424242424241")).toBe(false)
    expect(isValidLuhn("42424242424242a2")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("always starts with the 4242 BIN, is 16 digits, and passes Luhn", () => {
    for (let i = 0; i < 1000; i++) {
      const number = generateCardNumber()
      expect(number).toMatch(/^4242\d{12}$/)
      expect(isValidLuhn(number)).toBe(true)
    }
  })

  it("appends the check digit to the generated body", () => {
    expect(generateCardNumber(() => 0)).toBe("4242000000000000")
    expect(generateCardNumber(() => 1)).toBe("4242111111111113")
  })
})

describe("maskCardNumber", () => {
  it("shows only the last four", () => {
    expect(maskCardNumber("1234")).toBe("•••• 1234")
  })
})

describe("canTransition", () => {
  const allowed: [CardStatus, CardStatus][] = [
    ["active", "frozen"],
    ["frozen", "active"],
    ["active", "cancelled"],
    ["frozen", "cancelled"],
  ]

  it.each(allowed)("allows %s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })

  it("rejects a transition to the same status", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })
})

describe("validateIssueCard", () => {
  const valid = {
    nickname: "Figma seats",
    merchantId: "mch_01",
    limit: "250.00",
    currency: "USD",
  }

  it("converts the limit to minor units once", () => {
    const result = validateIssueCard(valid)
    expect(result).toEqual({
      ok: true,
      value: {
        nickname: "Figma seats",
        merchantId: "mch_01",
        limit: 25000,
        currency: "USD",
        category: null,
      },
    })
  })

  it.each([
    ["a missing merchant", { ...valid, merchantId: undefined }, "merchantId"],
    ["an unknown merchant", { ...valid, merchantId: "mch_99" }, "merchantId"],
    ["a zero limit", { ...valid, limit: "0" }, "limit"],
    ["a negative limit", { ...valid, limit: "-5" }, "limit"],
    ["a limit above 5,000,000 minor units", { ...valid, limit: "50000.01" }, "limit"],
    ["a limit sent as a number", { ...valid, limit: 25000 }, "limit"],
    ["a currency outside the allowlist", { ...valid, currency: "JPY" }, "currency"],
    ["a blank nickname", { ...valid, nickname: "   " }, "nickname"],
    ["an unknown category", { ...valid, category: "gambling" }, "category"],
  ])("rejects %s", (_, input, field) => {
    const result = validateIssueCard(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.field).toBe(field)
  })

  it("accepts the limit at exactly 5,000,000 minor units", () => {
    const result = validateIssueCard({ ...valid, limit: "50000.00" })
    expect(result.ok && result.value.limit).toBe(5_000_000)
  })

  it("accepts a category from the allowlist", () => {
    const result = validateIssueCard({ ...valid, category: "advertising" })
    expect(result.ok && result.value.category).toBe("advertising")
  })

  it("rejects a body that is not an object", () => {
    expect(validateIssueCard(null).ok).toBe(false)
    expect(validateIssueCard("card").ok).toBe(false)
  })
})
