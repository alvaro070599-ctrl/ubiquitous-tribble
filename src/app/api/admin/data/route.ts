import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { getSharpixelConfig } from "@/lib/company";
import { releaseExpiredReservations } from "@/lib/reservations";
import { isSameOrigin, readJsonObject } from "@/lib/http";

export const runtime = "nodejs";
export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    await releaseExpiredReservations();
    const [settings, numbers, orders] = await Promise.all([
      prisma.siteSettings.findUnique({ where: { id: 1 } }),
      prisma.raffleNumber.findMany({ orderBy: { number: "asc" } }),
      prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 100 })
    ]);
    // Pix dinâmico é gerado pelo Mercado Pago; a chave estática nunca é devolvida pela API.
    const safeSettings = settings ? {
      title: settings.title, priceCents: settings.priceCents,
      drawDate: settings.drawDate, instagram: settings.instagram,
      pixKeyConfigured: Boolean(settings.pixKey), pixNameConfigured: Boolean(settings.pixName)
    } : null;
    const safeOrders = orders.map(({ pixQrCode: _qr, pixQrCodeBase64: _image, ...order }) => order);
    return NextResponse.json({ settings: safeSettings, numbers, orders: safeOrders, sharpixel: getSharpixelConfig() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar o painel. Confira a conexão com o banco de dados." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem da solicitação inválida." }, { status: 403 });
  if (!await isAdmin()) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: "Envie um objeto JSON válido." }, { status: 400 });

  const data: {
    title?: string; priceCents?: number; drawDate?: string; instagram?: string;
    pixKey?: string | null; pixName?: string | null;
  } = {};
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim().slice(0, 120);
  if (typeof body.priceCents === "number" && Number.isInteger(body.priceCents) && body.priceCents >= 100 && body.priceCents <= 1000000) data.priceCents = body.priceCents;
  if (typeof body.drawDate === "string") data.drawDate = body.drawDate.trim().slice(0, 80);
  if (typeof body.instagram === "string") data.instagram = body.instagram.trim().slice(0, 80);
  // Campos opcionais aceitam string vazia para permitir apagá-los.
  if (typeof body.pixKey === "string" && body.pixKey.trim()) data.pixKey = body.pixKey.trim().slice(0, 200);
  if (typeof body.pixName === "string" && body.pixName.trim()) data.pixName = body.pixName.trim().slice(0, 120);

  if (!Object.keys(data).length) return NextResponse.json({ error: "Nenhuma configuração válida foi enviada." }, { status: 400 });
  try {
    const settings = await prisma.siteSettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
    return NextResponse.json({ ok: true, settings: { title: settings.title, priceCents: settings.priceCents, drawDate: settings.drawDate, instagram: settings.instagram } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível salvar as configurações. Confira o banco de dados." }, { status: 503 });
  }
}
