import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  exportLabel,
  parseColumns,
  parseScope,
  toCsv,
} from "./csv"

/**
 * The export is the file ops hands to a merchant, so a broken cell is a
 * support ticket rather than a stack trace. These tests pin the escaping and
 * the column contract; NWP-101 changes which columns ship, not how a cell is
 * written, and these should still pass afterwards.
 */

const payment: Payment = {
  id: "pay_0001",
  merchantId: "mch_01",
  amount: 25000,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt: "2026-03-14T10:15:00.000Z",
  description: "Order 1180",
}

describe("toCsv", () => {
  it("writes a header row followed by one row per payment", () => {
    const lines = toCsv([payment]).split("\n")
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe(EXPORT_COLUMNS.join(","))
  })

  it("writes only the requested columns, in the order given", () => {
    expect(toCsv([payment], ["id", "amount"])).toBe(
      ["id,amount", "pay_0001,$250.00"].join("\n"),
    )
  })

  it("quotes cells containing a comma, so amounts do not split", () => {
    const large = { ...payment, amount: 123456789 }
    expect(toCsv([large], ["amount"])).toBe(['amount', '"$1,234,567.89"'].join("\n"))
  })

  it("doubles embedded quotes rather than dropping them", () => {
    const quoted = { ...payment, description: 'Order "rush"' }
    expect(toCsv([quoted], ["description"])).toBe(
      ["description", '"Order ""rush"""'].join("\n"),
    )
  })

  it("keeps a newline inside a description in one quoted cell", () => {
    const multiline = { ...payment, description: "Order 1180\nsecond line" }
    const body = toCsv([multiline], ["description"]).split("\n").slice(1).join("\n")
    expect(body).toBe('"Order 1180\nsecond line"')
  })

  it("resolves the merchant name, and falls back to the id when unknown", () => {
    expect(toCsv([payment], ["merchant"])).toContain("Lumen Coffee Roasters")
    const orphan = { ...payment, merchantId: "mch_missing" }
    expect(toCsv([orphan], ["merchant"])).toContain("mch_missing")
  })

  it("writes an empty cell for a payment with no card", () => {
    const bank: Payment = {
      ...payment,
      method: "bank_transfer",
      cardBrand: null,
      last4: null,
    }
    expect(toCsv([bank], ["card_brand", "last4"])).toBe(
      ["card_brand,last4", ","].join("\n"),
    )
  })

  it("emits a header even with no rows", () => {
    expect(toCsv([], ["id"])).toBe("id")
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("puts the scope label between the prefix and the date", () => {
    expect(exportFilename(new Date("2026-08-13T12:00:00.000Z"), "disputed")).toBe(
      "payments-disputed-2026-08-13.csv",
    )
  })
})

describe("parseColumns", () => {
  it("keeps a subset of columns in the order requested", () => {
    const columns = parseColumns("amount,id,currency")
    expect(columns).toEqual(["amount", "id", "currency"])
    expect(toCsv([payment], columns!)).toBe(
      ["amount,id,currency", "$250.00,pay_0001,USD"].join("\n"),
    )
  })

  it("excludes the card last four by default", () => {
    const columns = parseColumns(null)
    expect(columns).toEqual([...DEFAULT_EXPORT_COLUMNS])
    expect(columns).not.toContain("last4")
    expect(columns).toHaveLength(EXPORT_COLUMNS.length - 1)
    expect(toCsv([payment], columns!)).not.toContain("4242")
  })

  it("returns an empty selection for an empty param, so the route can refuse it", () => {
    expect(parseColumns("")).toEqual([])
    expect(parseColumns(" , ")).toEqual([])
  })

  it("rejects the whole request when any column is not on the allowlist", () => {
    expect(parseColumns("id,pan")).toBeNull()
    expect(parseColumns("id;drop table")).toBeNull()
  })

  it("drops duplicates and tolerates whitespace", () => {
    expect(parseColumns(" id , amount,id")).toEqual(["id", "amount"])
  })
})

describe("parseScope", () => {
  it("defaults to the current filter for anything but 'all'", () => {
    expect(parseScope(null)).toBe("filtered")
    expect(parseScope("everything")).toBe("filtered")
    expect(parseScope("all")).toBe("all")
  })
})

describe("exportLabel", () => {
  it("names the status filter", () => {
    expect(exportLabel({ status: "disputed" }, "filtered")).toBe("disputed")
  })

  it("adds a known merchant id and ignores an unknown one", () => {
    expect(exportLabel({ status: "refunded", merchantId: "mch_01" }, "filtered")).toBe(
      "refunded-mch_01",
    )
    expect(exportLabel({ merchantId: "../../etc" }, "filtered")).toBe("filtered")
  })

  it("says 'all' for the all scope or when nothing is filtered", () => {
    expect(exportLabel({ status: "disputed" }, "all")).toBe("all")
    expect(exportLabel({ status: "all" }, "filtered")).toBe("all")
  })

  it("never puts search text in the filename", () => {
    expect(exportLabel({ search: 'x"; rm -rf' }, "filtered")).toBe("filtered")
  })
})
