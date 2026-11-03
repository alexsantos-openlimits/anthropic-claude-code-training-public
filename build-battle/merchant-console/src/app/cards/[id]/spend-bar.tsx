import { Currency } from "@/data/types"
import { cx } from "@/lib/utils"
import { formatMoney } from "@/lib/money"

/** Spend against the limit. A new card has spent nothing, and says so. */
export function SpendBar({
  spent,
  limit,
  currency,
}: {
  spent: number
  limit: number
  currency: Currency
}) {
  // Integer minor units throughout; the percentage is the only derived number.
  const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0
  const high = pct >= 80
  const remaining = Math.max(0, limit - spent)

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
          Spend
        </h2>
        <p className="text-sm tabular-nums text-gray-500">
          {formatMoney(spent, currency)} of {formatMoney(limit, currency)}
        </p>
      </div>
      <div
        className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label="Spend against the limit"
      >
        <div
          className={cx(
            "h-full rounded-full transition-all",
            high ? "bg-amber-500" : "bg-blue-500",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {spent === 0
          ? "Nothing spent on this card yet."
          : `${formatMoney(remaining, currency)} left${high ? " — past 80% of the limit." : "."}`}
      </p>
    </div>
  )
}
