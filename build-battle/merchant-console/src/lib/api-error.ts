import { NextResponse } from "next/server"

/**
 * The one error shape route handlers return: a status code that means what
 * it says, and a message safe to show a user. `field` names the input at
 * fault so a form can put the message next to it.
 */
export function apiError(status: number, message: string, field?: string) {
  return NextResponse.json(
    { error: field ? { message, field } : { message } },
    { status },
  )
}
