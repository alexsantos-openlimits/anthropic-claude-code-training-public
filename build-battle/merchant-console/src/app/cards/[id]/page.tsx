import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { maskedNumber } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardActions } from "./card-actions"
import { SpendBar } from "./spend-bar"

const EVENT_LABEL = {
  issued: "Issued",
  frozen: "Frozen",
  unfrozen: "Unfrozen",
  cancelled: "Cancelled",
} as const

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)
  // A card's history is reconciled against the merchant's own calendar, so it
  // converts to their timezone, as the payment detail page does.
  const zone = merchant?.timezone ?? "UTC"

  return (
    <section aria-label={`Card ${card.nickname}`} className="px-4 py-6 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-gray-500 transition hover:text-gray-700 dark:hover:text-gray-300"
      >
        &larr; All cards
      </Link>

      <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
            {card.nickname}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {merchant?.name ?? card.merchantId} &middot;{" "}
            <span className="tabular-nums">{maskedNumber(card.last4)}</span>{" "}
            &middot; issued {formatInZone(card.createdAt, zone)}
          </p>
        </div>
        <CardActions id={card.id} status={card.status} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-8">
          <SpendBar
            spent={card.spent}
            limit={card.limit}
            currency={card.currency}
          />

          <div>
            <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
              History
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Every change to this card, in {zone.replace("_", " ")} time.
            </p>
            <ol className="mt-3 space-y-0">
              {card.events
                .slice()
                .reverse()
                .map((event, index) => (
                  <li
                    key={`${event.at}-${index}`}
                    className="flex items-baseline gap-4 border-t border-gray-200 py-2.5 text-sm first:border-t-0 dark:border-gray-800"
                  >
                    <span className="w-44 shrink-0 tabular-nums text-xs text-gray-500">
                      {formatInZone(event.at, zone)}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-gray-50">
                      {EVENT_LABEL[event.action]}
                    </span>
                    {event.from && (
                      <span className="text-gray-500">
                        {event.from} &rarr; {event.to}
                      </span>
                    )}
                  </li>
                ))}
            </ol>
          </div>
        </div>

        <dl className="space-y-4 text-sm">
          {[
            ["Card", maskedNumber(card.last4)],
            ["Reference", card.reference],
            ["Merchant", merchant?.name ?? card.merchantId],
            ["Currency", card.currency],
            ["Spend limit", formatMoney(card.limit, card.currency)],
            ["Category lock", card.categoryLock ?? "None"],
            ["Status", card.status],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex justify-between gap-4 border-b border-gray-200 pb-3 dark:border-gray-800"
            >
              <dt className="text-gray-500">{label}</dt>
              <dd className="text-right tabular-nums text-gray-900 dark:text-gray-50">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
