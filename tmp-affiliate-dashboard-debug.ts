import { PrismaService } from "./src/modules/prisma/prisma.service";
import { AffiliateService } from "./src/modules/affiliate/affiliate.service";

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const service = new AffiliateService(prisma);

  for (const userId of [
    "cmrtw6c8f00009rrspiekougl",
    "cmrtw7h7n00049rrsgv8gpst3",
  ]) {
    console.log("=== DASHBOARD", userId, "===");
    const result = await service.getAffiliateDashboard(userId);
    console.log(JSON.stringify(result, null, 2));
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
