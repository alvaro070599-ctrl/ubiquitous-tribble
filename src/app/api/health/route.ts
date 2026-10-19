import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json({ ok: false, database: "not_configured" }, { status: 503 });
  try {
    const [settings, numberCount] = await Promise.all([
      prisma.siteSettings.findUnique({ where: { id: 1 }, select: { id: true } }),
      prisma.raffleNumber.count()
    ]);
    if (!settings || numberCount !== 500) {
      return NextResponse.json({ ok: false, database: "connected", setup: "incomplete", initializedNumbers: numberCount }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ ok: true, database: "connected", schema: "ready", initializedNumbers: numberCount }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, database: "unavailable" }, { status: 503 });
  }
}
