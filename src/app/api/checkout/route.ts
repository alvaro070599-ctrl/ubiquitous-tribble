import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import QRCode from "qrcode";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/reservations";
import { readJsonObject } from "@/lib/http";

export const runtime = "nodejs";

function publicError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return publicError("O banco de dados ainda não está configurado.", 503);
  const body = await readJsonObject(request);
  if (!body) return publicError("Envie os dados da compra em formato válido.", 400);

  const rawNumbers = Array.isArray(body.numbers) ? body.numbers : [];
  const nums: number[] = Array.from(new Set<number>(rawNumbers.map((value: unknown) => Number(value)))).sort((a, b) => a - b);
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ").slice(0, 120) : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 180) : "";
  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 40) : "";
  if (!nums.length || nums.length > 20 || nums.some(n => !Number.isInteger(n) || n < 1 || n > 500) || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.replace(/\D/g, "").length < 8) {
    return publicError("Confira os números e preencha nome, e-mail e telefone corretamente. É possível selecionar até 20 números por compra.", 400);
  }
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) return publicError("O pagamento ainda não está configurado. O administrador precisa adicionar as credenciais do Mercado Pago.", 503);

  let reservationId = "";
  let paymentWasCreated = false;
  try {
    await releaseExpiredReservations();
    const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
    const priceCents = settings?.priceCents ?? 1000;
    if (!Number.isInteger(priceCents) || priceCents < 100) return publicError("O valor por número está configurado incorretamente.", 503);

    reservationId = randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const amountCents = nums.length * priceCents;

    await prisma.$transaction(async tx => {
      const current = await tx.raffleNumber.findMany({ where: { number: { in: nums } }, select: { number: true, status: true } });
      if (current.length !== nums.length || current.some(n => n.status !== "AVAILABLE")) throw new Error("NUMBERS_UNAVAILABLE");
      const reservation = await tx.raffleNumber.updateMany({
        where: { number: { in: nums }, status: "AVAILABLE" },
        data: { status: "PENDING", buyerName: name, buyerEmail: email, buyerPhone: phone, reservationId, expiresAt }
      });
      if (reservation.count !== nums.length) throw new Error("RESERVATION_CONFLICT");
      await tx.order.create({ data: { id: reservationId, buyerName: name, buyerEmail: email, buyerPhone: phone, numbers: nums.join(","), amountCents, status: "PENDING" } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN, options: { timeout: 7000, maxRetries: 0 } });
    const paymentApi = new Payment(client);
    let result: Awaited<ReturnType<typeof paymentApi.create>>;
    try {
      result = await paymentApi.create({
        body: {
          transaction_amount: amountCents / 100,
          description: `Rifa Nicolly & João - números ${nums.map(n => String(n).padStart(3, "0")).join(", ")}`,
          payment_method_id: "pix",
          payer: { email, first_name: name.split(" ")[0], last_name: name.split(" ").slice(1).join(" ") || name },
          external_reference: reservationId,
          date_of_expiration: expiresAt.toISOString()
        },
        requestOptions: { idempotencyKey: reservationId }
      });
    } catch {
      await cancelReservation(reservationId);
      return publicError("O provedor não conseguiu criar a cobrança Pix. Nenhum pagamento foi confirmado; tente novamente.", 502);
    }

    if (!result.id) {
      // Não liberar reserva automaticamente: o provedor retornou uma resposta ambígua.
      return publicError("A cobrança foi solicitada, mas não recebemos a confirmação técnica. Aguarde ou contate o organizador antes de tentar novamente.", 502);
    }
    paymentWasCreated = true;
    const txData = result.point_of_interaction?.transaction_data;
    const qr = txData?.qr_code || undefined;
    const base64 = txData?.qr_code_base64 || undefined;
    const image = base64 ? base64.replace(/^data:image\/\w+;base64,/, "") : (qr ? (await QRCode.toDataURL(qr)).split(",")[1] : undefined);

    // Salvar a referência antes de devolver dados ao comprador. Se esta gravação falhar,
    // preservamos a reserva: o webhook consegue localizar o pedido via external_reference.
    await prisma.$transaction([
      prisma.order.update({ where: { id: reservationId }, data: { paymentId: String(result.id), pixQrCode: qr ?? null, pixQrCodeBase64: image ?? null, pixTicketUrl: txData?.ticket_url ?? null } }),
      prisma.raffleNumber.updateMany({ where: { reservationId }, data: { paymentId: String(result.id) } })
    ]);
    return NextResponse.json({ orderId: reservationId, qr, image, ticket: txData?.ticket_url, paymentAvailable: Boolean(qr || txData?.ticket_url) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (reservationId && !paymentWasCreated) {
      try { await cancelReservation(reservationId); } catch { /* preservar erro público genérico */ }
    }
    if (error instanceof Error && ["NUMBERS_UNAVAILABLE", "RESERVATION_CONFLICT"].includes(error.message)) {
      return publicError("Um ou mais números acabaram de ser reservados. Atualize a página e escolha outros números.", 409);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return publicError("Houve uma disputa de reserva entre compradores. Atualize a página e tente novamente.", 409);
    }
    return publicError("Não foi possível iniciar a compra. Verifique a conexão do sistema e tente novamente mais tarde.", 503);
  }
}

async function cancelReservation(id: string) {
  await prisma.$transaction([
    prisma.raffleNumber.updateMany({ where: { reservationId: id, status: "PENDING" }, data: { status: "AVAILABLE", buyerName: null, buyerEmail: null, buyerPhone: null, reservationId: null, paymentId: null, expiresAt: null } }),
    prisma.order.updateMany({ where: { id, status: "PENDING", paymentId: null }, data: { status: "CANCELLED" } })
  ]);
}
