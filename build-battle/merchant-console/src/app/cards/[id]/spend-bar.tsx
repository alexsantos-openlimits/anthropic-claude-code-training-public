import { Currency } from "@/data/types"
import { cx } from "@/lib/utils"
import { formatMoney } from "@/lib/money"

/** Fill widths, written out so Tailwind keeps them in the build. */
const WIDTHS = {
  0: "w-0",
  5: "w-[5%]",
  10: "w-[10%]",
  15: "w-[15%]",
  20: "w-1/5",
  25: "w-1/4",
  30: "w-[30%]",
  35: "w-[35%]",
  40: "w-2/5",
  45: "w-[45%]",
  50: "w-1/2",
  55: "w-[55%]",
  60: "w-3/5",
  65: "w-[65%]",
  70: "w-[70%]",
  75: "w-3/4",
  80: "w-4/5",
  85: "w-[85%]",
  90: "w-[90%]",
  95: "w-[95%]",
  100: "w-full",
} as const

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
  // Tailwind only, per .claude/rules/components.md: the fill snaps to the
  // nearest twentieth rather than carrying an inline style.
  const step = (Math.round(pct / 5) * 5) as keyof typeof WIDTHS
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
            WIDTHS[step],
            high ? "bg-amber-500" : "bg-blue-500",
          )}
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
