import "server-only";
import { prisma } from "@/lib/prisma";

/** Libera reservas pendentes expiradas. Pode ser chamada em invocações serverless. */
export async function releaseExpiredReservations() {
  const now = new Date();
  const expired = await prisma.raffleNumber.findMany({
    where: { status: "PENDING", expiresAt: { lte: now } },
    select: { reservationId: true },
    distinct: ["reservationId"]
  });
  const ids = expired.map(item => item.reservationId).filter((id): id is string => Boolean(id));
  if (!ids.length) return;
  await prisma.$transaction([
    prisma.raffleNumber.updateMany({
      where: { reservationId: { in: ids }, status: "PENDING", expiresAt: { lte: now } },
      data: { status: "AVAILABLE", buyerName: null, buyerEmail: null, buyerPhone: null, reservationId: null, paymentId: null, expiresAt: null }
    }),
    prisma.order.updateMany({ where: { id: { in: ids }, status: "PENDING" }, data: { status: "EXPIRED" } })
  ]);
}
