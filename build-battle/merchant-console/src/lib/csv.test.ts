import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  parseExportColumns,
  parseExportScope,
  toCsv,
} from "./csv"

/**
 * The export is the file ops hands to a merchant, so a broken cell is a
 * support ticket rather than a stack trace. These tests pin the escaping, the
 * column selection, and the filename.
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

describe("column selection", () => {
  it("leaves the card last four out by default", () => {
    expect(DEFAULT_EXPORT_COLUMNS).not.toContain("last4")
    expect(parseExportColumns(null)).toEqual({
      ok: true,
      columns: [...DEFAULT_EXPORT_COLUMNS],
    })
  })

  it("returns a subset in the order requested, not the table's order", () => {
    expect(parseExportColumns("amount,id,currency")).toEqual({
      ok: true,
      columns: ["amount", "id", "currency"],
    })
  })

  it("includes the card last four only when it is asked for", () => {
    expect(parseExportColumns("id,last4")).toEqual({
      ok: true,
      columns: ["id", "last4"],
    })
  })

  it("drops duplicate names and keeps the first position", () => {
    expect(parseExportColumns("id,amount,id")).toEqual({
      ok: true,
      columns: ["id", "amount"],
    })
  })

  it("rejects an empty selection rather than producing an empty file", () => {
    expect(parseExportColumns("")).toEqual({
      ok: false,
      error: "Select at least one column",
    })
    expect(parseExportColumns(" , ")).toEqual({
      ok: false,
      error: "Select at least one column",
    })
  })

  it("rejects any name outside the allowlist", () => {
    expect(parseExportColumns("id,card_number")).toEqual({
      ok: false,
      error: "Unknown export column: card_number",
    })
  })

  it("falls back to the filter scope for anything unexpected", () => {
    expect(parseExportScope("all")).toBe("all")
    expect(parseExportScope("filter")).toBe("filter")
    expect(parseExportScope("everything")).toBe("filter")
    expect(parseExportScope(null)).toBe("filter")
  })
})

describe("exportFilename", () => {
  it("names the file for its scope and stamps the UTC date", () => {
    expect(exportFilename("all", new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-all-2026-03-14.csv",
    )
  })

  it("uses the status when the table is filtered to one", () => {
    expect(exportFilename("disputed", new Date("2026-08-13T08:00:00.000Z"))).toBe(
      "payments-disputed-2026-08-13.csv",
    )
  })
})
