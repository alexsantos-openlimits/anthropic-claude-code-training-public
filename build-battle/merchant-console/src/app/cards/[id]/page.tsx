import { Divider } from "@/components/Divider"
import { DetailField as Field } from "@/components/ui/DetailField"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CardEvent } from "@/data/types"
import { maskCardNumber } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardStatusActions } from "../card-status-actions"

function eventLabel(event: CardEvent): string {
  if (event.from === null) return "Issued"
  if (event.to === "frozen") return "Frozen"
  if (event.to === "cancelled") return "Cancelled"
  return "Unfrozen"
}

export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)!
  const remaining = Math.max(0, card.spendLimit - card.spent)
  // Integer comparison: past 80% when spent / limit > 4 / 5.
  const nearLimit = card.spent * 5 > card.spendLimit * 4
  const percent = Math.floor((card.spent * 100) / card.spendLimit)

  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50"
      >
        ← All cards
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
          {card.nickname}
        </h1>
        <StatusBadge status={card.status} />
      </div>
      <p className="mt-1 font-mono text-sm tabular-nums text-gray-500">
        {maskCardNumber(card.last4)} · {card.id}
      </p>

      <div className="mt-6">
        <CardStatusActions cardId={card.id} status={card.status} />
      </div>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend
      </h2>
      <p className="mt-2 text-sm tabular-nums text-gray-900 dark:text-gray-50">
        {formatMoney(card.spent, card.currency)} of{" "}
        {formatMoney(card.spendLimit, card.currency)}
        <span className="ml-2 text-gray-500">
          {percent}% used · {formatMoney(remaining, card.currency)} left
        </span>
      </p>
      <progress
        value={card.spent}
        max={card.spendLimit}
        aria-label={`Spend against limit, ${percent}% used`}
        className={cx(
          "mt-2 h-2 w-full max-w-md appearance-none overflow-hidden rounded-full",
          "[&::-webkit-progress-bar]:bg-gray-200 dark:[&::-webkit-progress-bar]:bg-gray-800",
          nearLimit
            ? "[&::-moz-progress-bar]:bg-amber-500 [&::-webkit-progress-value]:bg-amber-500"
            : "[&::-moz-progress-bar]:bg-blue-500 [&::-webkit-progress-value]:bg-blue-500",
        )}
      />
      {nearLimit && (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-500">
          Over 80% of the limit is spent.
        </p>
      )}

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          <Link
            href={`/payments?merchantId=${merchant.id}`}
            className="text-blue-600 hover:underline dark:text-blue-500"
          >
            {merchant.name}
          </Link>
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Spend limit">
          {formatMoney(card.spendLimit, card.currency)}
          <span className="ml-2 text-gray-500">{card.currency}</span>
        </Field>
        <Field label="Card">{maskCardNumber(card.last4)}</Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        <Field label={`Created (${merchant.timezone})`}>
          {formatInZone(card.createdAt, merchant.timezone)}
        </Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Status history
      </h2>
      <ol className="mt-4 space-y-4">
        {[...card.history].reverse().map((event) => (
          <li key={event.at + event.to} className="flex gap-3">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-50">
                {eventLabel(event)}
              </p>
              <p className="text-sm text-gray-500">
                {formatInZone(event.at, merchant.timezone)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
