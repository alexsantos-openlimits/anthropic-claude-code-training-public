import { describe, expect, it } from "vitest"
import { sortPayments } from "./queries"
import { Payment } from "./types"

/**
 * Sorting by amount compared the numbers as text, so $90.00 ranked above
 * $1,000.00. These pin the ordering as numeric, in both directions.
 */

function payment(amount: number, id: string): Payment {
  return {
    id,
    merchantId: "mch_01",
    amount,
    currency: "USD",
    status: "captured",
    method: "card",
    cardBrand: "visa",
    last4: "4242",
    createdAt: "2026-03-14T10:15:00.000Z",
    description: "Order",
  }
}

const amounts = [9000, 100000, 500, 25000, 1000000, 1]

describe("sortPayments by amount", () => {
  it("puts the largest first, descending", () => {
    const sorted = sortPayments(
      amounts.map((a, i) => payment(a, `pay_${i}`)),
      "amount",
      "desc",
    )
    expect(sorted.map((p) => p.amount)).toEqual([1000000, 100000, 25000, 9000, 500, 1])
  })

  it("puts the smallest first, ascending", () => {
    const sorted = sortPayments(
      amounts.map((a, i) => payment(a, `pay_${i}`)),
      "amount",
      "asc",
    )
    expect(sorted.map((p) => p.amount)).toEqual([1, 500, 9000, 25000, 100000, 1000000])
  })

  it("ranks $1,000.00 above $90.00, which text comparison does not", () => {
    // 9000 sorts after 100000 as text, because "9" > "1".
    const sorted = sortPayments(
      [payment(9000, "pay_small"), payment(100000, "pay_big")],
      "amount",
      "desc",
    )
    expect(sorted[0].amount).toBe(100000)
  })

  it("keeps equal amounts in their original order", () => {
    const sorted = sortPayments(
      [payment(5000, "pay_a"), payment(5000, "pay_b")],
      "amount",
      "asc",
    )
    expect(sorted.map((p) => p.id)).toEqual(["pay_a", "pay_b"])
  })

  it("leaves the input array alone", () => {
    const input = [payment(500, "pay_a"), payment(100, "pay_b")]
    sortPayments(input, "amount", "asc")
    expect(input.map((p) => p.amount)).toEqual([500, 100])
  })
})

describe("sortPayments by date", () => {
  it("still orders newest first by default", () => {
    const older = { ...payment(100, "pay_old"), createdAt: "2026-01-01T00:00:00.000Z" }
    const newer = { ...payment(100, "pay_new"), createdAt: "2026-06-01T00:00:00.000Z" }
    expect(sortPayments([older, newer]).map((p) => p.id)).toEqual(["pay_new", "pay_old"])
  })
})
