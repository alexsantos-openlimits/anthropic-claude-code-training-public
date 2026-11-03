import { generateCardNumber } from "@/lib/cards"
import { merchantById, merchants } from "./merchants"
import {
  Card,
  CardCategory,
  CardEvent,
  Currency,
  Dispute,
  Payment,
  PaymentStatus,
  Payout,
  Refund,
} from "./types"

/**
 * Deterministic seed data. Everyone in the room gets identical records,
 * so a bug reproduces the same way on every machine.
 */

const SEED = 20260813
const DAYS = 120
const PAYMENTS_PER_DAY = 14

/** Small, fast, deterministic PRNG. Not for anything that matters. */
function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(SEED)
const pick = <T>(items: readonly T[]): T =>
  items[Math.floor(rand() * items.length)]
const between = (min: number, max: number) =>
  Math.floor(rand() * (max - min + 1)) + min

const DESCRIPTIONS = [
  "Online order",
  "In-store purchase",
  "Subscription renewal",
  "Gift card",
  "Wholesale invoice",
  "Repeat order",
  "Marketplace order",
]

const REASON_CODES = [
  "10.4 Other Fraud",
  "12.6 Duplicate Processing",
  "13.1 Merchandise Not Received",
  "13.3 Not as Described",
  "13.7 Cancelled Merchandise",
]

const pad = (n: number, width = 6) => String(n).padStart(width, "0")

/** The anchor date. Fixed, so "the last 30 days" is stable across runs. */
export const GENERATED_AT = new Date("2026-08-13T00:00:00.000Z")

function statusFor(): PaymentStatus {
  const roll = rand()
  if (roll < 0.78) return "captured"
  if (roll < 0.86) return "authorized"
  if (roll < 0.93) return "refunded"
  if (roll < 0.98) return "failed"
  return "disputed"
}

export function generate() {
  const payments: Payment[] = []
  const refunds: Refund[] = []
  const disputes: Dispute[] = []
  let paymentSeq = 0
  let refundSeq = 0
  let disputeSeq = 0

  for (let day = DAYS - 1; day >= 0; day--) {
    const dayStart = new Date(GENERATED_AT)
    dayStart.setUTCDate(dayStart.getUTCDate() - day)

    const count = between(PAYMENTS_PER_DAY - 5, PAYMENTS_PER_DAY + 5)

    for (let i = 0; i < count; i++) {
      const merchant = pick(merchants)
      const createdAt = new Date(dayStart)
      createdAt.setUTCHours(between(0, 23), between(0, 59), between(0, 59), 0)

      const status = statusFor()
      const method = rand() < 0.82 ? "card" : rand() < 0.6 ? "wallet" : "bank_transfer"
      const amount = between(450, 480_00)

      const payment: Payment = {
        id: `pay_${pad(++paymentSeq)}`,
        merchantId: merchant.id,
        amount,
        currency: merchant.currency as Currency,
        status,
        method,
        cardBrand:
          method === "card" ? pick(["visa", "mastercard", "amex"] as const) : null,
        last4: method === "card" ? String(between(1000, 9999)) : null,
        createdAt: createdAt.toISOString(),
        description: pick(DESCRIPTIONS),
      }
      payments.push(payment)

      if (status === "refunded") {
        const full = rand() < 0.7
        refunds.push({
          id: `re_${pad(++refundSeq)}`,
          paymentId: payment.id,
          amount: full ? amount : Math.floor(amount / 2),
          currency: payment.currency,
          reason: pick([
            "requested_by_customer",
            "duplicate",
            "fraudulent",
          ] as const),
          createdAt: new Date(
            createdAt.getTime() + between(1, 6) * 86_400_000,
          ).toISOString(),
        })
      }

      if (status === "disputed") {
        const openedAt = new Date(createdAt.getTime() + between(2, 10) * 86_400_000)
        disputes.push({
          id: `dp_${pad(++disputeSeq)}`,
          paymentId: payment.id,
          merchantId: merchant.id,
          amount,
          currency: payment.currency,
          reasonCode: pick(REASON_CODES),
          status: pick([
            "needs_response",
            "needs_response",
            "under_review",
            "won",
            "lost",
          ] as const),
          openedAt: openedAt.toISOString(),
          evidenceDueAt: new Date(
            openedAt.getTime() + 14 * 86_400_000,
          ).toISOString(),
        })
      }
    }
  }

  const payouts = generatePayouts(payments)
  return { payments, refunds, disputes, payouts }
}

function generatePayouts(payments: Payment[]): Payout[] {
  const payouts: Payout[] = []
  let seq = 0

  for (const merchant of merchants) {
    for (let week = 0; week < 8; week++) {
      const periodEnd = new Date(GENERATED_AT)
      periodEnd.setUTCDate(periodEnd.getUTCDate() - week * 7)
      const periodStart = new Date(periodEnd)
      periodStart.setUTCDate(periodStart.getUTCDate() - 7)

      const inPeriod = payments.filter(
        (p) =>
          p.merchantId === merchant.id &&
          p.status === "captured" &&
          p.createdAt >= periodStart.toISOString() &&
          p.createdAt < periodEnd.toISOString(),
      )
      if (inPeriod.length === 0) continue

      const gross = inPeriod.reduce((sum, p) => sum + p.amount, 0)
      const fees = Math.round(gross * 0.029) + inPeriod.length * 30

      payouts.push({
        id: `po_${pad(++seq, 4)}`,
        merchantId: merchant.id,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        gross,
        fees,
        net: gross - fees,
        currency: merchant.currency,
        status: week === 0 ? "pending" : week === 1 ? "in_transit" : "paid",
        paymentIds: inPeriod.map((p) => p.id),
      })
    }
  }

  return payouts
}

const daysBefore = (days: number) =>
  new Date(GENERATED_AT.getTime() - days * 86_400_000).toISOString()

/**
 * Demo cards, so the list and the spend bar have something real on first
 * load. Each card's spend is the sum of its seeded charges; numbers come from
 * the same 4242 generator the issue route uses.
 */
export function generateCards(): Card[] {
  type Charge = [description: string, amount: number, daysAgo: number]
  const seeds: {
    nickname: string
    merchantId: string
    category: CardCategory
    spendLimit: number
    issuedDaysAgo: number
    charges: Charge[]
    history?: Omit<CardEvent, "at"> & { daysAgo: number }
  }[] = [
    {
      nickname: "Google Ads, always on",
      merchantId: "mch_01",
      category: "advertising",
      spendLimit: 500000,
      issuedDaysAgo: 40,
      charges: [
        ["Search campaign", 150000, 35],
        ["Search campaign", 150000, 21],
        ["Holiday preview ads", 112500, 4],
      ],
    },
    {
      nickname: "Design tool seats",
      merchantId: "mch_04",
      category: "software",
      spendLimit: 120000,
      issuedDaysAgo: 25,
      charges: [
        ["Monthly seats", 18000, 24],
        ["Monthly seats", 18000, 1],
      ],
    },
    {
      nickname: "Contractor tools",
      merchantId: "mch_05",
      category: "contractors",
      spendLimit: 250000,
      issuedDaysAgo: 60,
      charges: [],
      history: { from: "active", to: "frozen", daysAgo: 6 },
    },
    {
      nickname: "Trade show deposit",
      merchantId: "mch_07",
      category: "travel",
      spendLimit: 1000000,
      issuedDaysAgo: 75,
      charges: [
        ["Booth deposit", 400000, 70],
        ["Hotel block", 240000, 45],
      ],
      history: { from: "active", to: "cancelled", daysAgo: 20 },
    },
    {
      nickname: "Storefront apps",
      merchantId: "mch_10",
      category: "software",
      spendLimit: 30000,
      issuedDaysAgo: 10,
      charges: [
        ["Reviews app", 14900, 9],
        ["Shipping labels app", 15000, 2],
      ],
    },
  ]

  return seeds.map((seed, index) => {
    const createdAt = daysBefore(seed.issuedDaysAgo)
    const history: CardEvent[] = [{ from: null, to: "active", at: createdAt }]
    if (seed.history) {
      history.push({
        from: seed.history.from,
        to: seed.history.to,
        at: daysBefore(seed.history.daysAgo),
      })
    }
    return {
      id: `crd_${pad(index + 1, 4)}`,
      nickname: seed.nickname,
      merchantId: seed.merchantId,
      last4: generateCardNumber(rand).slice(-4),
      spendLimit: seed.spendLimit,
      currency: merchantById(seed.merchantId)!.currency,
      category: seed.category,
      status: history[history.length - 1].to,
      createdAt,
      history,
      charges: seed.charges.map(([description, amount, daysAgo]) => ({
        description,
        amount,
        at: daysBefore(daysAgo),
      })),
    }
  })
}
