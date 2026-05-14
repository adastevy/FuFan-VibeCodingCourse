import { NextResponse } from "next/server";
import { readRecentDailyNews } from "@/lib/nanoclaw/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = readRecentDailyNews(10);
    return NextResponse.json({ items, count: items.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, items: [] }, { status: 500 });
  }
}
