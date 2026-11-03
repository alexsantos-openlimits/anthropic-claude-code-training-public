import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  exportScopeToken,
  parseExportColumns,
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

describe("DEFAULT_EXPORT_COLUMNS", () => {
  it("leaves the card last four out, so an unedited file is safe to send", () => {
    expect(DEFAULT_EXPORT_COLUMNS).not.toContain("last4")
  })

  it("keeps every other column, in the order the allowlist declares", () => {
    expect(DEFAULT_EXPORT_COLUMNS).toEqual(
      EXPORT_COLUMNS.filter((column) => column !== "last4"),
    )
  })

  it("still pairs each amount with its currency", () => {
    expect(DEFAULT_EXPORT_COLUMNS).toContain("amount")
    expect(DEFAULT_EXPORT_COLUMNS).toContain("currency")
  })
})

describe("parseExportColumns", () => {
  it("falls back to the default set when the client names no columns", () => {
    expect(parseExportColumns(null)).toEqual([...DEFAULT_EXPORT_COLUMNS])
  })

  it("accepts allowlisted names and keeps the order asked for", () => {
    expect(parseExportColumns("amount,id")).toEqual(["amount", "id"])
  })

  it("honours last4 when it is asked for explicitly", () => {
    expect(parseExportColumns("id,last4")).toEqual(["id", "last4"])
  })

  it("rejects a name that is not on the allowlist", () => {
    expect(parseExportColumns("id,nonsense")).toBeNull()
  })

  it("rejects an injected expression rather than passing it along", () => {
    expect(parseExportColumns("id; DROP TABLE payments")).toBeNull()
  })

  it("rejects an empty selection rather than writing a header-only file", () => {
    expect(parseExportColumns("")).toBeNull()
    expect(parseExportColumns(" , ")).toBeNull()
  })

  it("collapses a duplicated column", () => {
    expect(parseExportColumns("id,id,amount")).toEqual(["id", "amount"])
  })
})

describe("exportScopeToken", () => {
  it("names the status when one is filtering", () => {
    expect(exportScopeToken({ status: "disputed" }, "filter")).toBe("disputed")
  })

  it("says all for an unfiltered table", () => {
    expect(exportScopeToken({ status: "all" }, "filter")).toBe("all")
    expect(exportScopeToken({}, "filter")).toBe("all")
  })

  it("says all whenever the scope is every payment, filters or not", () => {
    expect(exportScopeToken({ status: "disputed" }, "all")).toBe("all")
  })

  it("says filtered when something other than status narrows the rows", () => {
    expect(exportScopeToken({ merchantId: "mch_01" }, "filter")).toBe("filtered")
    expect(exportScopeToken({ search: "rush" }, "filter")).toBe("filtered")
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("names the scope between the prefix and the date", () => {
    expect(
      exportFilename(new Date("2026-08-13T10:00:00.000Z"), "disputed"),
    ).toBe("payments-disputed-2026-08-13.csv")
  })

  it("strips anything that does not belong in a filename", () => {
    expect(exportFilename(new Date("2026-08-13T10:00:00.000Z"), "../etc")).toBe(
      "payments-etc-2026-08-13.csv",
    )
  })
})
