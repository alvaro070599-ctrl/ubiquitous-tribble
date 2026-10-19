import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE = "rifa_admin";
const SESSION_SECONDS = 60 * 60 * 8;

function secret() {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("ADMIN_SESSION_SECRET precisa ter pelo menos 32 caracteres.");
  return value;
}
function signature(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}
export function makeAdminToken(now = Date.now()) {
  const expiresAt = Math.floor(now / 1000) + SESSION_SECONDS;
  const payload = `admin-session-v1.${expiresAt}`;
  return `${payload}.${signature(payload)}`;
}
export async function isAdmin() {
  if (!process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.length < 32) return false;
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value || "";
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [version, expiresText, suppliedSignature] = parts;
  const expiresAt = Number(expiresText);
  if (version !== "admin-session-v1" || !Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;
  const payload = `${version}.${expiresText}`;
  const expectedSignature = signature(payload);
  const supplied = Buffer.from(suppliedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
