import { NextResponse } from "next/server";
import { readDailyNewsTask } from "@/lib/nanoclaw/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const task = readDailyNewsTask();
    return NextResponse.json({ task });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, task: null }, { status: 500 });
  }
}
