import { NextResponse } from "next/server"

export function GET() {
  return NextResponse.json({
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    twitter: Boolean(process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET),
    telegram: Boolean(process.env.TELEGRAM_BOT_USERNAME && process.env.TELEGRAM_BOT_TOKEN),
    telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME ?? null,
  }, {
    headers: { "Cache-Control": "no-store" },
  })
}
