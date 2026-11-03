import { listCards } from "@/data/cards"
import { merchants } from "@/data/merchants"
import { CardsTable } from "./cards-table"

export default function CardsPage() {
  const cards = listCards()

  return (
    <section aria-label="Virtual cards">
      <CardsTable
        cards={cards}
        merchants={merchants.map((m) => ({
          id: m.id,
          name: m.name,
          currency: m.currency,
        }))}
      />
    </section>
  )
}
