import { PrismaService } from "./src/modules/prisma/prisma.service";
import { SellersService } from "./src/modules/sellers/sellers.service";

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const service = new SellersService(prisma);

  const result = await service.getAffiliateLinksForSeller(
    "cmredqudb0007m5yi8otpkyp0",
  );
  console.log(JSON.stringify(result, null, 2));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
