import { GENERATED_AT } from "./generate"
import { merchants } from "./merchants"
import { filterPayments } from "./queries"
import { store } from "./store"

/**
 * Weekly rollups for the monitoring dashboard. Buckets are UTC weeks ending
 * on the generation date, oldest first.
 */

const WEEK_MS = 7 * 86_400_000

export interface WeekBucket {
  date: string
  start: number
  end: number
}

export function weeks(count = 12): WeekBucket[] {
  const buckets: WeekBucket[] = []
  const anchor = GENERATED_AT.getTime()
  for (let i = count - 1; i >= 0; i--) {
    const end = anchor - i * WEEK_MS
    const start = end - WEEK_MS
    buckets.push({
      date: new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        month: "short",
        day: "numeric",
      }).format(new Date(start)),
      start,
      end,
    })
  }
  return buckets
}

/**
 * The query builder's `from` and `to` are both inclusive, and a week's end is
 * exclusive, so `to` is the last millisecond of the week. Payments are stored
 * as ISO strings with millisecond precision, so string comparison orders them.
 */
const windowOf = (bucket: WeekBucket) => ({
  from: new Date(bucket.start).toISOString(),
  to: new Date(bucket.end - 1).toISOString(),
})

/**
 * Captured volume this period against the period before it. Values are minor
 * units; the chart formats them for display.
 */
export function volumeByWeek(count = 12) {
  const current = weeks(count)
  return current.map((week) => {
    const previous: WeekBucket = {
      ...week,
      start: week.start - count * WEEK_MS,
      end: week.end - count * WEEK_MS,
    }
    const sum = (bucket: WeekBucket) =>
      filterPayments({ status: "captured", ...windowOf(bucket) }).reduce(
        (total, p) => total + p.amount,
        0,
      )

    return {
      date: week.date,
      "This period": sum(week),
      "Previous period": sum(previous),
    }
  })
}

/** Payment count against captured volume, for the biaxial chart. */
export function countAndVolumeByWeek(count = 12) {
  return weeks(count).map((week) => {
    const captured = filterPayments({ status: "captured", ...windowOf(week) })
    return {
      date: week.date,
      Payments: filterPayments(windowOf(week)).length,
      "Captured volume": captured.reduce((total, p) => total + p.amount, 0),
    }
  })
}

/** Approved against failed, rendered as a percentage stack. */
export function authorizationByWeek(count = 12) {
  return weeks(count).map((week) => {
    const inBucket = filterPayments(windowOf(week)).length
    const failed = filterPayments({ status: "failed", ...windowOf(week) }).length
    return {
      date: week.date,
      Approved: inBucket - failed,
      Failed: failed,
    }
  })
}

/** Share of payments that ended in a dispute, per week. */
export function disputeRateByWeek(count = 12) {
  return weeks(count).map((week) => {
    const inBucket = filterPayments(windowOf(week)).length
    const disputed = filterPayments({ status: "disputed", ...windowOf(week) })
      .length
    return {
      date: week.date,
      "Dispute rate": inBucket ? disputed / inBucket : 0,
    }
  })
}

/** Per-merchant rollup for the merchants tab. */
export function merchantRollup() {
  return merchants
    .map((merchant) => {
      const payments = filterPayments({ merchantId: merchant.id })
      const captured = filterPayments({
        merchantId: merchant.id,
        status: "captured",
      })
      const disputes = store.disputes.filter(
        (d) => d.merchantId === merchant.id,
      )
      const failed = filterPayments({
        merchantId: merchant.id,
        status: "failed",
      }).length

      return {
        merchant,
        payments: payments.length,
        volume: captured.reduce((total, p) => total + p.amount, 0),
        disputes: disputes.length,
        authRate: payments.length
          ? (payments.length - failed) / payments.length
          : 0,
      }
    })
    .sort((a, b) => b.volume - a.volume)
}
