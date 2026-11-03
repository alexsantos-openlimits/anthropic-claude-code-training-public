import { describe, expect, it } from "vitest"
import { isValidLuhn } from "@/lib/cards"
import { cardById, issueCard, setCardStatus } from "./cards"
import { store } from "./store"

/**
 * The store-facing half of the card rules: what gets kept after issue, how a
 * repeated request is answered, and the state machine as the server enforces
 * it. Each test issues its own cards, so they do not depend on seed state.
 */

const input = {
  nickname: "Test card",
  merchantId: "mch_01",
  limit: 25000,
  currency: "USD" as const,
  category: null,
}

describe("issueCard", () => {
  it("returns the full number once and stores only the last four", () => {
    const result = issueCard(input)
    expect(result.status).toBe("created")
    if (result.status !== "created") return

    expect(result.number).toMatch(/^4242\d{12}$/)
    expect(isValidLuhn(result.number)).toBe(true)
    expect(result.card.last4).toBe(result.number.slice(-4))

    const stored = cardById(result.card.id)!
    expect(stored).not.toHaveProperty("number")
    expect(JSON.stringify(stored)).not.toContain(result.number)
  })

  it("replays a repeated key with the same details, without the number", () => {
    const first = issueCard(input, "key-same-details")
    const before = store.cards.length
    const again = issueCard(input, "key-same-details")

    expect(again.status).toBe("replayed")
    expect(again.card.id).toBe(first.card.id)
    expect(again).not.toHaveProperty("number")
    expect(store.cards.length).toBe(before)
  })

  it("rejects a repeated key with different details instead of returning the old card", () => {
    const first = issueCard(input, "key-changed-limit")
    const before = store.cards.length
    const changed = issueCard({ ...input, limit: 2500 }, "key-changed-limit")

    expect(changed.status).toBe("conflict")
    expect(changed.card.id).toBe(first.card.id)
    expect(changed).not.toHaveProperty("number")
    expect(store.cards.length).toBe(before)
  })

  it("starts every new card active, at zero spend, with an issued event", () => {
    const { card } = issueCard(input)
    expect(card.status).toBe("active")
    expect(card.spent).toBe(0)
    expect(card.events.map((e) => e.type)).toEqual(["issued"])
  })
})

describe("setCardStatus", () => {
  it("freezes, unfreezes and cancels, recording each step", () => {
    const { card } = issueCard(input)
    expect(setCardStatus(card.id, "frozen").ok).toBe(true)
    expect(setCardStatus(card.id, "active").ok).toBe(true)
    expect(setCardStatus(card.id, "cancelled").ok).toBe(true)
    expect(cardById(card.id)!.events.map((e) => e.type)).toEqual([
      "issued",
      "frozen",
      "unfrozen",
      "cancelled",
    ])
  })

  it("refuses to bring a cancelled card back and leaves it unchanged", () => {
    const { card } = issueCard(input)
    setCardStatus(card.id, "cancelled")
    const result = setCardStatus(card.id, "active")

    expect(result).toMatchObject({ ok: false, reason: "not_allowed" })
    expect(cardById(card.id)!.status).toBe("cancelled")
    expect(cardById(card.id)!.events).toHaveLength(2)
  })

  it("reports an unknown card", () => {
    expect(setCardStatus("card_missing", "frozen")).toMatchObject({
      ok: false,
      reason: "not_found",
    })
  })
})
