import { NextRequest, NextResponse } from "next/server";
import { listContentTasks } from "@/lib/nanoclaw/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawLimit = searchParams.get("limit");
  let limit = rawLimit !== null ? parseInt(rawLimit, 10) : 10;
  if (isNaN(limit) || limit < 1) limit = 10;
  if (limit > 100) limit = 100;

  try {
    const tasks = listContentTasks(limit);
    return NextResponse.json({ tasks, count: tasks.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, tasks: [] }, { status: 500 });
  }
}
