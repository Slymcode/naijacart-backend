const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  try {
    const userIds = ["cmrtw6c8f00009rrspiekougl", "cmrtw7h7n00049rrsgv8gpst3"];
    for (const userId of userIds) {
      const affiliate = await prisma.affiliate.findUnique({
        where: { userId },
        include: {
          affiliateLinks: { include: { product: true } },
          referrals: true,
          commissions: true,
        },
      });
      console.log("AFFILIATE", userId, affiliate.code);
      const orderId = affiliate.commissions[0]?.orderId;
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      console.log(
        "ORDER ITEMS",
        order.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          affiliateCode: i.affiliateCode,
          sellerId: i.sellerId,
          price: i.price,
          quantity: i.quantity,
        })),
      );

      const affiliateLinkByCode = new Map(
        affiliate.affiliateLinks.map((link) => [link.code, link]),
      );
      const affiliateLinkByProductId = new Map(
        affiliate.affiliateLinks.map((link) => [
          link.productId || link.product?.id,
          link,
        ]),
      );
      const getLinkForItem = (item) => {
        if (!item) return undefined;
        if (item.affiliateCode) {
          return affiliateLinkByCode.get(item.affiliateCode);
        }
        if (item.productId) {
          return affiliateLinkByProductId.get(item.productId);
        }
        return undefined;
      };
      const directMatches = order.items
        .map((item) => ({ item, link: getLinkForItem(item) }))
        .filter((x) => x.link);
      console.log(
        "DIRECT MATCHES",
        directMatches.map(({ item, link }) => ({
          itemId: item.id,
          itemAffCode: item.affiliateCode,
          linkCode: link.code,
          itemProduct: item.productId,
          linkProduct: link.productId,
        })),
      );

      const referralsByOrderId = new Map(
        affiliate.referrals
          .filter((r) => !!r.orderId)
          .map((r) => [r.orderId, r.source]),
      );
      const referralSource = referralsByOrderId.get(order.id);
      const referralLink = referralSource
        ? affiliateLinkByCode.get(referralSource)
        : undefined;
      const referralMatches = referralLink
        ? order.items
            .filter(
              (item) =>
                item.productId && item.productId === referralLink.productId,
            )
            .map((item) => ({ item, link: referralLink }))
        : [];
      console.log(
        "REFERRAL MATCHES",
        referralMatches.map(({ item, link }) => ({
          itemId: item.id,
          itemProduct: item.productId,
          linkProduct: link.productId,
          linkCode: link.code,
        })),
      );

      console.log(
        "commission amounts",
        affiliate.commissions.map((c) => ({
          id: c.id,
          amount: c.amount,
          status: c.status,
        })),
      );
    }
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
})();
