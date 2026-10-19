import { NextResponse } from "next/server";

/** Parseia JSON sem deixar payload inválido virar erro 500 com detalhes internos. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Protege operações administrativas contra formulários enviados de outras origens. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function internalError(message = "Não foi possível concluir a operação.") {
  return NextResponse.json({ error: message }, { status: 500 });
}
