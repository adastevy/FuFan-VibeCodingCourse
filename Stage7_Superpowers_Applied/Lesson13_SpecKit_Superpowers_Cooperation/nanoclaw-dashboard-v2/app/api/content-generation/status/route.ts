import { NextRequest, NextResponse } from "next/server";
import { readContentTask, readContentArticles } from "@/lib/nanoclaw/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("taskId");

  if (!taskId) {
    return NextResponse.json({ error: "taskId query param is required" }, { status: 400 });
  }

  const task = readContentTask(taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const articles = readContentArticles(taskId);
  return NextResponse.json({ task, articles });
}
