import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin";
import { isSameOrigin } from "@/lib/http";
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem da solicitação inválida." }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
