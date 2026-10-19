import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };

function validateSignature(signatureHeader: string, requestId: string, dataId: string, secret: string): boolean {
  const parts = Object.fromEntries(signatureHeader.split(",").map(part => {
    const idx = part.indexOf("=");
    return idx < 0 ? [part.trim(), ""] : [part.slice(0, idx).trim(), part.slice(idx + 1).trim()];
  }));
  const timestamp = Number(parts.ts);
  const providedHash = typeof parts.v1 === "string" ? parts.v1 : "";
  if (!Number.isFinite(timestamp) || !providedHash || !requestId || !dataId) return false;
  // Mercado Pago signs this canonical manifest for the Payments API.
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expectedHash = createHmac("sha256", secret).update(manifest).digest("hex");
  const received = Buffer.from(providedHash, "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const body: any = await request.json();
    const dataId = String(body?.data?.id ?? url.searchParams.get("data.id") ?? "").trim();
    const paymentId = dataId;
    if (!paymentId || !/^\d+$/.test(paymentId)) return NextResponse.json({ ok: true }, { headers: noStore });

    const webhookSecret = process.env.MP_WEBHOOK_SECRET;
    if (process.env.NODE_ENV === "production") {
      if (!webhookSecret) return NextResponse.json({ error: "A assinatura do webhook não está configurada." }, { status: 503, headers: noStore });
      const valid = validateSignature(request.headers.get("x-signature") || "", request.headers.get("x-request-id") || "", dataId, webhookSecret);
      if (!valid) return NextResponse.json({ error: "Assinatura do webhook inválida." }, { status: 401, headers: noStore });
    } else if (webhookSecret) {
      const valid = validateSignature(request.headers.get("x-signature") || "", request.headers.get("x-request-id") || "", dataId, webhookSecret);
      if (!valid) return NextResponse.json({ error: "Assinatura do webhook inválida." }, { status: 401, headers: noStore });
    }

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) return NextResponse.json({ error: "Integração de pagamentos não configurada." }, { status: 503, headers: noStore });
    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN, options: { timeout: 7000, maxRetries: 0 } });
    const payment = await new Payment(client).get({ id: paymentId });
    const orderId = payment.external_reference;
    if (!orderId) return NextResponse.json({ ok: true }, { headers: noStore });
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return NextResponse.json({ ok: true }, { headers: noStore });
    if (order.paymentId && order.paymentId !== paymentId) return NextResponse.json({ error: "O pagamento não corresponde ao pedido." }, { status: 409, headers: noStore });
    if (!Number.isFinite(Number(payment.transaction_amount)) || Math.round(Number(payment.transaction_amount) * 100) !== order.amountCents || payment.currency_id !== "BRL") {
      return NextResponse.json({ error: "Os dados do pagamento não correspondem ao pedido." }, { status: 400, headers: noStore });
    }

    if (payment.status === "approved") {
      const state = await prisma.$transaction(async tx => {
        const current = await tx.order.findUnique({ where: { id: orderId } });
        if (!current) return "NOT_FOUND";
        if (current.status === "PAID") return "PAID";
        const now = new Date();
        const expectedNumbers = current.numbers.split(",").filter(Boolean);
        const ownedNumbers = await tx.raffleNumber.findMany({ where: { reservationId: orderId }, select: { number: true, status: true, expiresAt: true } });
        const stillOwnsReservation = current.status === "PENDING"
          && ownedNumbers.length === expectedNumbers.length
          && ownedNumbers.every(n => n.status === "PENDING" && (!n.expiresAt || n.expiresAt > now));
        if (!stillOwnsReservation) {
          await tx.order.update({ where: { id: orderId }, data: { status: "PAID_REVIEW", paidAt: now, paymentId: paymentId } });
          return "PAID_REVIEW";
        }
        const changed = await tx.raffleNumber.updateMany({
          where: { reservationId: orderId, status: "PENDING", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          data: { status: "PAID", paidAt: now, expiresAt: null, paymentId }
        });
        if (changed.count !== expectedNumbers.length) throw new Error("RESERVATION_CONFLICT");
        await tx.order.update({ where: { id: orderId }, data: { status: "PAID", paidAt: now, paymentId } });
        return "PAID";
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      // Paid after numbers were released: preserve other buyers' reservations and flag for manual resolution.
      return NextResponse.json({ ok: true, state }, { headers: noStore });
    }

    if ((payment.status === "rejected" || payment.status === "cancelled") && order.status === "PENDING") {
      await prisma.$transaction(async tx => {
        const current = await tx.order.findUnique({ where: { id: orderId } });
        if (!current || current.status !== "PENDING") return;
        await tx.raffleNumber.updateMany({
          where: { reservationId: orderId, status: "PENDING" },
          data: { status: "AVAILABLE", buyerName: null, buyerEmail: null, buyerPhone: null, reservationId: null, paymentId: null, expiresAt: null }
        });
        await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED", paymentId } });
      });
    }
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    if (error instanceof Error && error.message === "RESERVATION_CONFLICT") return NextResponse.json({ error: "A reserva mudou durante a atualização. A notificação pode ser reenviada." }, { status: 503, headers: noStore });
    // Do not send provider or database exceptions to the caller.
    return NextResponse.json({ error: "Falha ao processar a notificação de pagamento." }, { status: 503, headers: noStore });
  }
}
