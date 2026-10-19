import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/reservations";
import RaffleClient from "@/components/RaffleClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  await releaseExpiredReservations();
  const [numbers, settings] = await Promise.all([
    prisma.raffleNumber.findMany({ select: { number: true, status: true } }),
    prisma.siteSettings.findUnique({ where: { id: 1 } })
  ]);
  const config = settings || { title: "Rifa em prol do nosso casamento", priceCents: 1000, drawDate: "30 de novembro", instagram: "@joaoenicky" };
  const counts = {
    available: numbers.filter(n => n.status === "AVAILABLE").length,
    pending: numbers.filter(n => n.status === "PENDING").length,
    paid: numbers.filter(n => n.status === "PAID").length
  };
  return <RaffleClient numbers={numbers} settings={{ title: config.title, priceCents: config.priceCents, drawDate: config.drawDate, instagram: config.instagram }} counts={counts} />;
}
