import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CardEvent } from "@/data/types"
import { CATEGORY_LABELS, maskCardNumber } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardStatusActions } from "../card-status-actions"

const EVENT_LABELS: Record<CardEvent["type"], string> = {
  issued: "Card issued",
  frozen: "Frozen",
  unfrozen: "Unfrozen",
  cancelled: "Cancelled",
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
  const remaining = Math.max(0, card.limit - card.spent)
  const percentUsed = Math.min(100, Math.floor((card.spent * 100) / card.limit))
  const pastWarning = card.spent * 100 > card.limit * 80

  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50"
      >
        ← All cards
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
              {card.nickname}
            </h1>
            <StatusBadge status={card.status} />
          </div>
          <p className="mt-1 font-mono text-sm text-gray-500">
            {maskCardNumber(card.last4)} · {card.id}
          </p>
        </div>
        <CardStatusActions
          cardId={card.id}
          nickname={card.nickname}
          status={card.status}
        />
      </div>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Card number">
          <span className="font-mono">{maskCardNumber(card.last4)}</span>
        </Field>
        <Field label="Spend limit">
          {formatMoney(card.limit, card.currency)}
          <span className="ml-2 text-gray-500">{card.currency}</span>
        </Field>
        <Field label="Merchant category lock">
          {card.category ? CATEGORY_LABELS[card.category] : "Any category"}
        </Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        <Field label={`Created (${merchant.timezone})`}>
          {formatInZone(card.createdAt, merchant.timezone)}
        </Field>
        <Field label="Issuer reference">
          <span className="font-mono text-sm">{card.panReference}</span>
        </Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend
      </h2>
      <p className="mt-4 text-sm text-gray-900 dark:text-gray-50">
        <span className="font-medium tabular-nums">
          {formatMoney(card.spent, card.currency)}
        </span>{" "}
        <span className="text-gray-500">
          spent of {formatMoney(card.limit, card.currency)}
        </span>
      </p>
      <progress
        value={card.spent}
        max={card.limit}
        aria-label={`Spend against limit, ${percentUsed}% used`}
        className={cx(
          "mt-3 h-2 w-full max-w-xl appearance-none overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800",
          "[&::-webkit-progress-bar]:bg-gray-200 dark:[&::-webkit-progress-bar]:bg-gray-800",
          "[&::-webkit-progress-value]:rounded-full [&::-moz-progress-bar]:rounded-full",
          pastWarning
            ? "[&::-moz-progress-bar]:bg-amber-500 [&::-webkit-progress-value]:bg-amber-500"
            : "[&::-moz-progress-bar]:bg-blue-500 [&::-webkit-progress-value]:bg-blue-500",
        )}
      />
      <p
        className={cx(
          "mt-2 text-sm tabular-nums",
          pastWarning ? "text-amber-700 dark:text-amber-400" : "text-gray-500",
        )}
      >
        {percentUsed}% used · {formatMoney(remaining, card.currency)} remaining
        {pastWarning &&
          (remaining === 0 ? " · Limit reached" : " · Past 80% of the limit")}
      </p>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        History
      </h2>
      <ol className="mt-4 space-y-4">
        {card.events.map((event, index) => (
          <li key={index} className="flex gap-3">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-50">
                {EVENT_LABELS[event.type]}
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

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">{children}</dd>
    </div>
  )
}
