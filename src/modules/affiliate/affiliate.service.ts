import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  GenerateAffiliateLinkDto,
  WithdrawalRequestDto,
} from "./dto/affiliate.dto";

@Injectable()
export class AffiliateService {
  constructor(private prisma: PrismaService) {}

  async registerAffiliate(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { affiliate: true },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.affiliate) {
      throw new ConflictException("User is already registered as an affiliate");
    }

    // Generate unique affiliate code
    const code = `AFF-${Date.now()}-${Math.random()
      .toString(36)
      .substring(7)
      .toUpperCase()}`;

    const affiliate = await this.prisma.affiliate.create({
      data: {
        userId,
        code,
      },
    });

    // Update user role to AFFILIATE
    await this.prisma.user.update({
      where: { id: userId },
      data: { role: "AFFILIATE" },
    });

    return affiliate;
  }

  async getAffiliateProfile(userId: string) {
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { userId },
      include: {
        affiliateLinks: { include: { product: true } },
        commissions: true,
      },
    });

    if (!affiliate) {
      throw new NotFoundException("Affiliate profile not found");
    }

    return affiliate;
  }

  async generateAffiliateLink(
    userId: string,
    generateAffiliateLinkDto: GenerateAffiliateLinkDto,
  ) {
    const { productId } = generateAffiliateLinkDto;

    const affiliate = await this.prisma.affiliate.findUnique({
      where: { userId },
    });

    if (!affiliate) {
      throw new NotFoundException("Affiliate not registered");
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    // Check if link already exists
    const existingLink = await this.prisma.affiliateLink.findUnique({
      where: {
        affiliateId_productId: {
          affiliateId: affiliate.id,
          productId,
        },
      },
    });

    if (existingLink) {
      return existingLink;
    }

    const code = `${affiliate.code}-${product.slug}`;

    return this.prisma.affiliateLink.create({
      data: {
        affiliateId: affiliate.id,
        productId,
        code,
      },
    });
  }

  async getAffiliateDashboard(userId: string) {
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { userId },
      include: {
        affiliateLinks: { include: { product: { include: { seller: true } } } },
        commissions: true,
        referrals: { include: { order: true } },
        withdrawals: true,
      },
    });

    if (!affiliate) {
      throw new NotFoundException("Affiliate not found");
    }

    const linkConversions = affiliate.affiliateLinks.reduce(
      (map, link) => {
        map[link.id] = 0;
        return map;
      },
      {} as Record<string, number>,
    );

    affiliate.referrals.forEach((referral) => {
      const link = affiliate.affiliateLinks.find(
        (candidate) => candidate.code === referral.source,
      );

      if (link) {
        linkConversions[link.id] = (linkConversions[link.id] || 0) + 1;
      }
    });

    const orderCache = new Map<string, any>();
    const getOrderForCommission = async (orderId: string) => {
      if (orderCache.has(orderId)) {
        return orderCache.get(orderId);
      }

      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      orderCache.set(orderId, order);
      return order;
    };

    for (const commission of affiliate.commissions.filter(
      (c) => c.status === "APPROVED" || c.status === "PAID",
    )) {
      const order = await getOrderForCommission(commission.orderId);

      if (!order?.items?.length) continue;

      const hasReferral = affiliate.referrals.some(
        (referral) =>
          referral.orderId === commission.orderId &&
          referral.affiliateId === affiliate.id,
      );

      if (hasReferral) continue;

      const matchingLink = affiliate.affiliateLinks.find((link) => {
        const linkSellerId = link.product?.sellerId || link.product?.seller?.id;
        if (!linkSellerId) return false;
        return order.items.some((item) => item.sellerId === linkSellerId);
      });

      if (matchingLink) {
        linkConversions[matchingLink.id] =
          (linkConversions[matchingLink.id] || 0) + 1;
      }
    }

    const linksWithConversions = affiliate.affiliateLinks.map((link) => ({
      ...link,
      conversions: linkConversions[link.id] || 0,
    }));

    // Calculate stats
    const totalClicks = linksWithConversions.reduce(
      (sum, link) => sum + link.clicks,
      0,
    );

    const totalConversions = Object.values(linkConversions).reduce(
      (sum, count) => sum + count,
      0,
    );

    // Total earnings ever earned
    const totalEarnings = affiliate.commissions
      .filter((c) => c.status === "APPROVED" || c.status === "PAID")
      .reduce((sum, c) => sum + c.amount, 0);

    // Approved commissions
    const approvedCommissionTotal = affiliate.commissions
      .filter((c) => c.status === "APPROVED")
      .reduce((sum, c) => sum + c.amount, 0);

    // Money already requested/withdrawn
    const withdrawnOrReserved = affiliate.withdrawals
      .filter((w) => ["PENDING", "APPROVED", "COMPLETED"].includes(w.status))
      .reduce((sum, w) => sum + w.amount, 0);

    // Actual available earnings
    const availableEarnings = approvedCommissionTotal - withdrawnOrReserved;

    // Pending commissions
    const pendingEarnings = affiliate.commissions
      .filter((c) => c.status === "PENDING")
      .reduce((sum, c) => sum + c.amount, 0);

    const sellerBreakdown = Array.from(
      affiliate.affiliateLinks.reduce((map, link) => {
        const sellerId = link.product?.sellerId || link.product?.seller?.id;
        if (!sellerId) return map;

        const existing = map.get(sellerId) || {
          sellerId,
          sellerName: link.product?.seller?.businessName || "Unknown Seller",
          clicks: 0,
          conversions: 0,
          earnings: 0,
        };

        existing.clicks += link.clicks;
        existing.conversions += linkConversions[link.id] || 0;
        map.set(sellerId, existing);
        return map;
      }, new Map<string, any>()),
    ).map(([, entry]) => entry);

    for (const commission of affiliate.commissions.filter(
      (c) => c.status === "APPROVED" || c.status === "PAID",
    )) {
      const order = await getOrderForCommission(commission.orderId);

      if (!order?.items?.length) continue;

      const orderSubtotal = order.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );

      const sellerShares = new Map<string, number>();
      for (const item of order.items) {
        if (!item.sellerId) continue;
        const share =
          orderSubtotal > 0 ? (item.price * item.quantity) / orderSubtotal : 0;
        sellerShares.set(
          item.sellerId,
          (sellerShares.get(item.sellerId) || 0) + share,
        );
      }

      for (const [sellerId, share] of sellerShares.entries()) {
        const sellerAmount = commission.amount * share;
        const existing = sellerBreakdown.find(
          (entry) => entry.sellerId === sellerId,
        );
        if (existing) {
          existing.earnings += sellerAmount;
        } else {
          sellerBreakdown.push({
            sellerId,
            sellerName: "Unknown Seller",
            clicks: 0,
            conversions: 0,
            earnings: sellerAmount,
          });
        }
      }
    }

    sellerBreakdown.sort((a, b) => b.earnings - a.earnings);

    // Compute reserved/withdrawn amounts per seller so we can surface available amounts
    const sellerIds = sellerBreakdown.map((s) => s.sellerId).filter(Boolean);
    const reservedSums = await Promise.all(
      sellerIds.map(async (sellerId) => {
        const agg = await this.prisma.withdrawalRequest.aggregate({
          where: {
            affiliateId: affiliate.id,
            sellerId,
            status: { in: ["PENDING", "APPROVED", "COMPLETED"] },
          },
          _sum: { amount: true },
        });
        return agg._sum.amount || 0;
      }),
    );

    const breakdownWithAvailable = sellerBreakdown.map((entry) => {
      const idx = sellerIds.indexOf(entry.sellerId);
      const reserved = idx >= 0 ? reservedSums[idx] || 0 : 0;
      const earnings = Number((entry.earnings || 0).toFixed(2));
      const availableRaw = Math.max(0, earnings - reserved);
      const available = Number(availableRaw.toFixed(2));
      return { ...entry, earnings, availableToWithdraw: available };
    });

    return {
      affiliate,
      stats: {
        totalClicks,
        totalConversions,
        totalEarnings,
        availableEarnings,
        pendingEarnings,
        conversionRate:
          totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0,
      },
      links: linksWithConversions,
      sellerBreakdown: breakdownWithAvailable,
      recentReferrals: affiliate.referrals.slice(0, 10),
    };
  }

  async trackAffiliateClick(affiliateCode: string) {
    const link = await this.prisma.affiliateLink.findUnique({
      where: { code: affiliateCode },
    });

    if (link) {
      await Promise.all([
        this.prisma.affiliateLink.update({
          where: { code: affiliateCode },
          data: { clicks: link.clicks + 1 },
        }),
        this.prisma.affiliate.update({
          where: { id: link.affiliateId },
          data: { totalClicks: { increment: 1 } },
        }),
      ]);
    }

    return link;
  }

  async requestWithdrawal(
    userId: string,
    withdrawalRequestDto: WithdrawalRequestDto,
  ) {
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { userId },
    });

    if (!affiliate) {
      throw new NotFoundException("Affiliate not found");
    }

    const approvedCommissions = await this.prisma.commission.findMany({
      where: {
        affiliateId: affiliate.id,
        status: "APPROVED",
      },
    });

    const sellerId = (withdrawalRequestDto as any).sellerId;
    let totalApproved = approvedCommissions.reduce(
      (sum, c) => sum + c.amount,
      0,
    );

    if (sellerId) {
      const sellerCommissionTotals = await Promise.all(
        approvedCommissions.map(async (commission) => {
          const order = await this.prisma.order.findUnique({
            where: { id: commission.orderId },
            include: { items: true },
          });
          if (!order?.items?.length) return 0;

          const orderSubtotal = order.items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0,
          );
          const sellerSubtotal = order.items
            .filter((item) => item.sellerId === sellerId)
            .reduce((sum, item) => sum + item.price * item.quantity, 0);

          return orderSubtotal > 0
            ? (commission.amount * sellerSubtotal) / orderSubtotal
            : 0;
        }),
      );

      totalApproved = sellerCommissionTotals.reduce(
        (sum, value) => sum + value,
        0,
      );
    }

    // Get all withdrawals already reserved or paid
    // Sum outstanding requests; if sellerId provided, limit to that seller
    const outstandingWhere: any = {
      affiliateId: affiliate.id,
      status: {
        in: ["PENDING", "APPROVED", "COMPLETED"],
      },
    };
    if ((withdrawalRequestDto as any).sellerId) {
      outstandingWhere.sellerId = (withdrawalRequestDto as any).sellerId;
    }

    const outstandingRequests = await this.prisma.withdrawalRequest.aggregate({
      where: outstandingWhere,
      _sum: {
        amount: true,
      },
    });

    const reservedAmount = outstandingRequests._sum.amount || 0;

    const availableAmount = totalApproved - reservedAmount;

    if (withdrawalRequestDto.amount > availableAmount) {
      throw new BadRequestException(
        "Insufficient approved earnings available for withdrawal",
      );
    }

    return this.prisma.withdrawalRequest.create({
      data: {
        userId,
        affiliateId: affiliate.id,
        sellerId: (withdrawalRequestDto as any).sellerId || null,
        amount: withdrawalRequestDto.amount,
        bankName: withdrawalRequestDto.bankName,
        accountNumber: withdrawalRequestDto.accountNumber,
        accountHolder: withdrawalRequestDto.accountHolder,
      },
    });
  }

  async getWithdrawalRequests(userId: string) {
    return this.prisma.withdrawalRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getTopAffiliates(limit = 10) {
    const affiliates = await this.prisma.affiliate.findMany({
      take: limit,
      orderBy: { totalEarnings: "desc" },
      include: {
        user: true,
        referrals: true,
        commissions: true,
      },
    });

    return affiliates.map((aff) => ({
      ...aff,
      totalReferrals: aff.referrals.length,
    }));
  }
}
