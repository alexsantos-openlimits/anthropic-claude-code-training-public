import { cardById } from "@/data/cards"
import { apiError } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) return apiError(404, "No card with that id.")
  return NextResponse.json({ card })
}
