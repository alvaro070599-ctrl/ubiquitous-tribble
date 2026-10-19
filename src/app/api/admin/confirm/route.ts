import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { isSameOrigin, readJsonObject } from "@/lib/http";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem da solicitação inválida." }, { status: 403 });
  if (!await isAdmin()) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const body = await readJsonObject(request);
  const orderId = typeof body?.orderId === "string" ? body.orderId : "";
  if (!orderId || orderId.length > 80) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  try {
    const result = await prisma.$transaction(async tx => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) return { status: 404, error: "Pedido não encontrado." };
      if (order.status === "PAID") return { status: 200, ok: true };
      if (order.status !== "PENDING") return { status: 409, error: "Este pedido não está pendente. Verifique o estado do pagamento antes de qualquer ação." };
      const owned = await tx.raffleNumber.findMany({ where: { reservationId: order.id, status: "PENDING" }, select: { number: true } });
      const orderNumbers = order.numbers.split(",").filter(Boolean);
      if (owned.length !== orderNumbers.length) return { status: 409, error: "A reserva expirou ou os números já não pertencem a este pedido. Não foi feita nenhuma alteração." };
      const now = new Date();
      const changedNumbers = await tx.raffleNumber.updateMany({
        where: { reservationId: order.id, status: "PENDING", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        data: { status: "PAID", paidAt: now, expiresAt: null }
      });
      if (changedNumbers.count !== orderNumbers.length) throw new Error("RESERVATION_CONFLICT");
      await tx.order.update({ where: { id: order.id }, data: { status: "PAID", paidAt: now } });
      return { status: 200, ok: true };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json(result, { status: result.status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "RESERVATION_CONFLICT") return NextResponse.json({ error: "A reserva mudou durante a confirmação. Atualize o painel e verifique o pedido." }, { status: 409 });
    return NextResponse.json({ error: "Não foi possível confirmar o pagamento." }, { status: 503 });
  }
}
