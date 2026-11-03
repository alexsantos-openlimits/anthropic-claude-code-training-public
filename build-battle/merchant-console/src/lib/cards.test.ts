import { describe, expect, it } from "vitest"
import {
  canTransition,
  CARD_STATUSES,
  generateCardNumber,
  isValidLuhn,
  luhnCheckDigit,
  maskCardNumber,
  MAX_SPEND_LIMIT,
  validateIssueInput,
} from "./cards"

describe("luhn", () => {
  it("accepts the canonical test number", () => {
    expect(isValidLuhn("4242424242424242")).toBe(true)
  })

  it("rejects a number with a wrong check digit", () => {
    expect(isValidLuhn("4242424242424241")).toBe(false)
  })

  it("computes the check digit for the canonical test number", () => {
    expect(luhnCheckDigit("424242424242424")).toBe("2")
  })

  it("rejects non-digits", () => {
    expect(isValidLuhn("4242 4242 4242 4242")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("is 16 digits on the 4242 BIN with a valid check digit, every time", () => {
    for (let i = 0; i < 500; i++) {
      const number = generateCardNumber()
      expect(number).toMatch(/^4242\d{12}$/)
      expect(isValidLuhn(number)).toBe(true)
    }
  })

  it("covers the all-zero and all-nine edges", () => {
    for (const random of [() => 0, () => 0.99]) {
      const number = generateCardNumber(random)
      expect(number.startsWith("4242")).toBe(true)
      expect(isValidLuhn(number)).toBe(true)
    }
  })
})

describe("maskCardNumber", () => {
  it("shows the last four only", () => {
    expect(maskCardNumber("4242")).toBe("•••• 4242")
  })
})

describe("status transitions", () => {
  it("allows active ⇄ frozen", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("allows either live status to be cancelled", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    for (const to of CARD_STATUSES) {
      expect(canTransition("cancelled", to)).toBe(false)
    }
  })

  it("rejects a no-op transition", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
  })
})

describe("validateIssueInput", () => {
  const valid = {
    nickname: "  Ad spend  ",
    merchantId: "mch_01",
    spendLimit: 25000,
    currency: "USD",
  }

  it("accepts a valid request and trims the nickname", () => {
    const result = validateIssueInput(valid)
    expect(result).toEqual({
      ok: true,
      value: { ...valid, nickname: "Ad spend", idempotencyKey: undefined },
    })
  })

  const fieldFor = (body: unknown) => {
    const result = validateIssueInput(body)
    return result.ok ? null : result.field
  }

  it("rejects a missing or unknown merchant", () => {
    expect(fieldFor({ ...valid, merchantId: undefined })).toBe("merchantId")
    expect(fieldFor({ ...valid, merchantId: "mch_99" })).toBe("merchantId")
  })

  it("rejects a zero, negative, fractional, string, or oversized limit", () => {
    for (const spendLimit of [0, -100, 250.5, "25000", MAX_SPEND_LIMIT + 1]) {
      expect(fieldFor({ ...valid, spendLimit })).toBe("spendLimit")
    }
  })

  it("accepts a limit of exactly 5,000,000 minor units", () => {
    expect(fieldFor({ ...valid, spendLimit: MAX_SPEND_LIMIT })).toBeNull()
  })

  it("rejects a currency outside USD, EUR, GBP", () => {
    expect(fieldFor({ ...valid, currency: "JPY" })).toBe("currency")
    expect(fieldFor({ ...valid, currency: "usd" })).toBe("currency")
  })

  it("rejects a blank or over-long nickname", () => {
    expect(fieldFor({ ...valid, nickname: "   " })).toBe("nickname")
    expect(fieldFor({ ...valid, nickname: "x".repeat(61) })).toBe("nickname")
  })

  it("rejects a body that is not an object", () => {
    expect(fieldFor(null)).toBe("body")
    expect(fieldFor("nickname=x")).toBe("body")
  })
})
