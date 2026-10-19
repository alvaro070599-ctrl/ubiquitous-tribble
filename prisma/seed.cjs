require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function initialPriceCents() {
  const value = Number(process.env.RAFFLE_PRICE ?? "10");
  if (!Number.isFinite(value) || value < 1 || value > 10000) return 1000;
  return Math.round(value * 100);
}

async function main() {
  // One bulk insert; duplicates are skipped so existing number status is preserved.
  await prisma.raffleNumber.createMany({
    data: Array.from({ length: 500 }, (_, index) => ({ number: index + 1, status: "AVAILABLE" })),
    skipDuplicates: true
  });
  // Do not overwrite existing campaign settings when the script is rerun.
  await prisma.siteSettings.upsert({
    where: { id: 1 }, update: {}, create: {
      id: 1,
      title: process.env.RAFFLE_TITLE?.trim().slice(0, 120) || "Rifa em prol do nosso casamento",
      priceCents: initialPriceCents(),
      drawDate: process.env.RAFFLE_DRAW_DATE?.trim().slice(0, 80) || "30 de novembro",
      instagram: process.env.RAFFLE_INSTAGRAM?.trim().slice(0, 80) || "@joaoenicky"
    }
  });
}

main()
  .catch(() => { console.error("Falha ao inicializar a base de dados da rifa. Verifique DATABASE_URL e o esquema do PostgreSQL."); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());
