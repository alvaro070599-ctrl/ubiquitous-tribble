import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { ADMIN_COOKIE, makeAdminToken } from "@/lib/admin";
import { isSameOrigin, readJsonObject } from "@/lib/http";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem da solicitação inválida." }, { status: 403 });
  const configuredPassword = process.env.ADMIN_PASSWORD;
  const configuredSecret = process.env.ADMIN_SESSION_SECRET;
  if (!configuredPassword || configuredPassword.length < 12 || !configuredSecret || configuredSecret.length < 32) {
    return NextResponse.json({ error: "O painel administrativo não está configurado. Defina ADMIN_PASSWORD com pelo menos 12 caracteres e ADMIN_SESSION_SECRET com pelo menos 32 caracteres nas variáveis de ambiente." }, { status: 503 });
  }
  const body = await readJsonObject(request);
  const supplied = typeof body?.password === "string" ? body.password : "";
  const a = Buffer.from(supplied, "utf8");
  const b = Buffer.from(configuredPassword, "utf8");
  const valid = a.length === b.length && timingSafeEqual(a, b);
  if (!valid) return NextResponse.json({ error: "Senha inválida." }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, makeAdminToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8
  });
  return response;
}
