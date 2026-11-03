import { describe, expect, it } from "vitest"
import { sortPayments } from "./queries"
import { Payment } from "./types"

/**
 * Amounts are integer minor units, so sorting by amount must compare numbers.
 * Comparing them as strings orders by leading digit: 994 ($9.94) lands above
 * 9873 ($98.73) and 25000 ($250.00) sinks below both.
 */

function payment(id: string, amount: number, createdAt: string): Payment {
  return {
    id,
    merchantId: "mch_01",
    amount,
    currency: "USD",
    status: "captured",
    method: "card",
    cardBrand: "visa",
    last4: "4242",
    createdAt,
    description: "Order",
  }
}

const payments = [
  payment("pay_a", 994, "2026-03-01T10:00:00.000Z"),
  payment("pay_b", 25000, "2026-03-02T10:00:00.000Z"),
  payment("pay_c", 9873, "2026-03-03T10:00:00.000Z"),
  payment("pay_d", 100, "2026-03-04T10:00:00.000Z"),
  payment("pay_e", 9999, "2026-03-05T10:00:00.000Z"),
]

const amounts = (rows: Payment[]) => rows.map((p) => p.amount)

describe("sortPayments by amount", () => {
  it("puts the largest amount first when descending", () => {
    expect(amounts(sortPayments(payments, "amount", "desc"))).toEqual([
      25000, 9999, 9873, 994, 100,
    ])
  })

  it("puts the smallest amount first when ascending", () => {
    expect(amounts(sortPayments(payments, "amount", "asc"))).toEqual([
      100, 994, 9873, 9999, 25000,
    ])
  })

  it("does not reorder the input array", () => {
    sortPayments(payments, "amount", "desc")
    expect(payments.map((p) => p.id)).toEqual([
      "pay_a",
      "pay_b",
      "pay_c",
      "pay_d",
      "pay_e",
    ])
  })
})

describe("sortPayments by date", () => {
  it("still sorts newest first by default", () => {
    expect(sortPayments(payments).map((p) => p.id)).toEqual([
      "pay_e",
      "pay_d",
      "pay_c",
      "pay_b",
      "pay_a",
    ])
  })
})
