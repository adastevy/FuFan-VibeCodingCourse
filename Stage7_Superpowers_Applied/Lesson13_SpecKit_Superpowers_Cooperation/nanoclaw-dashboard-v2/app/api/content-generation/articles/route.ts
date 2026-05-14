import { NextRequest, NextResponse } from "next/server";
import { readAllContentArticles } from "@/lib/nanoclaw/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawLimit = searchParams.get("limit");
  let limit = rawLimit !== null ? parseInt(rawLimit, 10) : 100;
  if (isNaN(limit) || limit < 1) limit = 100;
  if (limit > 500) limit = 500;

  try {
    const result = readAllContentArticles(limit);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: message, articles: [], stats: null },
      { status: 500 },
    );
  }
}
