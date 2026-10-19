import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/reservations";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id || id.length > 80) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  try {
    await releaseExpiredReservations();
    const order = await prisma.order.findUnique({ where: { id }, select: { status: true, paidAt: true } });
    if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    return NextResponse.json({ status: order.status, paidAt: order.paidAt }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar o pedido." }, { status: 503 });
  }
}
