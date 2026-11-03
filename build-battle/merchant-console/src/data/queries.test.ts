import { describe, expect, it } from "vitest"
import { parseFilters } from "./queries"

/**
 * parseFilters is the one place client input becomes a query, and both the
 * payments table and the export route read it. NWP-101 shipped a page that
 * built its own filters instead, which let from/to reach the export but not
 * the table: the dialog promised 1,658 rows and the file held 615. These
 * tests pin what the parser reads so the two cannot drift apart again.
 */

function filters(query: string) {
  return parseFilters(new URLSearchParams(query))
}

describe("parseFilters", () => {
  it("reads the date range, which the export and the table both scope on", () => {
    const f = filters("from=2026-07-01&to=2026-07-31")
    expect(f.from).toBe("2026-07-01")
    expect(f.to).toBe("2026-07-31")
  })

  it("reads merchant and search", () => {
    const f = filters("merchantId=mch_01&search=rush")
    expect(f.merchantId).toBe("mch_01")
    expect(f.search).toBe("rush")
  })

  it("keeps an allowlisted status", () => {
    expect(filters("status=disputed").status).toBe("disputed")
  })

  it("falls back to all for a status that is not on the allowlist", () => {
    expect(filters("status=pending").status).toBe("all")
    expect(filters("status=../etc").status).toBe("all")
    expect(filters("").status).toBe("all")
  })

  it("allowlists the sort field and direction", () => {
    expect(filters("sort=amount&direction=asc").sort).toBe("amount")
    expect(filters("sort=amount&direction=asc").direction).toBe("asc")
    expect(filters("sort=merchant").sort).toBe("createdAt")
    expect(filters("direction=sideways").direction).toBe("desc")
  })

  it("refuses a page number that is not a positive number", () => {
    expect(filters("page=3").page).toBe(3)
    expect(filters("page=0").page).toBe(1)
    expect(filters("page=-2").page).toBe(1)
    expect(filters("page=abc").page).toBe(1)
    expect(filters("").page).toBe(1)
  })

  it("leaves absent filters undefined rather than empty strings", () => {
    const f = filters("")
    expect(f.from).toBeUndefined()
    expect(f.to).toBeUndefined()
    expect(f.merchantId).toBeUndefined()
    expect(f.search).toBeUndefined()
  })
})
