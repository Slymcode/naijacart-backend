const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const affiliateUserIds = [
  "cmrtw6c8f00009rrspiekougl",
  "cmrtw7h7n00049rrsgv8gpst3",
];
(async () => {
  try {
    for (const userId of affiliateUserIds) {
      const affiliate = await prisma.affiliate.findUnique({
        where: { userId },
        include: {
          affiliateLinks: { include: { product: true } },
          referrals: true,
          commissions: true,
          withdrawals: true,
        },
      });
      console.log("AFFILIATE", userId, JSON.stringify(affiliate, null, 2));
      if (!affiliate) continue;

      for (const commission of affiliate.commissions) {
        const order = await prisma.order.findUnique({
          where: { id: commission.orderId },
          include: { items: true },
        });
        console.log(
          " COMMISSION ORDER",
          commission.orderId,
          JSON.stringify(order, null, 2),
        );
      }

      for (const referral of affiliate.referrals) {
        if (!referral.orderId) continue;
        const order = await prisma.order.findUnique({
          where: { id: referral.orderId },
          include: { items: true },
        });
        console.log(
          " REFERRAL ORDER",
          referral.id,
          referral.source,
          referral.orderId,
          JSON.stringify(order, null, 2),
        );
      }
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
