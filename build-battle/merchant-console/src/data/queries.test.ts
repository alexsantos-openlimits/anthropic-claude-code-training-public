import { describe, expect, it } from "vitest"
import { parseFilters, sortPayments } from "./queries"
import { Payment } from "./types"

const base: Payment = {
  id: "pay_0001",
  merchantId: "mch_01",
  amount: 0,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt: "2026-03-14T10:15:00.000Z",
  description: "Order 1180",
}

const withAmount = (id: string, amount: number): Payment => ({ ...base, id, amount })

describe("sortPayments by amount", () => {
  const payments = [
    withAmount("a", 10000),
    withAmount("b", 9000),
    withAmount("c", 250),
    withAmount("d", 123456),
  ]

  it("orders minor units numerically, not as strings", () => {
    expect(sortPayments(payments, "amount", "asc").map((p) => p.amount)).toEqual([
      250, 9000, 10000, 123456,
    ])
  })

  it("reverses for descending", () => {
    expect(sortPayments(payments, "amount", "desc").map((p) => p.amount)).toEqual([
      123456, 10000, 9000, 250,
    ])
  })
})

describe("parseFilters", () => {
  const parse = (query: string) => parseFilters(new URLSearchParams(query))

  it("keeps a merchant id that exists and drops one that does not", () => {
    expect(parse("merchantId=mch_01").merchantId).toBe("mch_01")
    expect(parse("merchantId=mch_missing").merchantId).toBeUndefined()
  })

  it("accepts UTC ISO dates and timestamps as bounds", () => {
    const filters = parse("from=2026-08-01&to=2026-08-13T23:59:59.999Z")
    expect(filters.from).toBe("2026-08-01")
    expect(filters.to).toBe("2026-08-13T23:59:59.999Z")
  })

  it("drops bounds that are not UTC ISO, or not a real date", () => {
    expect(parse("from=garbage").from).toBeUndefined()
    expect(parse("from=08/01/2026").from).toBeUndefined()
    expect(parse("to=2026-08-13T10:00:00+02:00").to).toBeUndefined()
    expect(parse("from=2026-13-45").from).toBeUndefined()
  })

  it("treats an empty search as no search", () => {
    expect(parse("search=").search).toBeUndefined()
  })
})
