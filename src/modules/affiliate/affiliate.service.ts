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
        commissions: { include: { product: true, order: true } },
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
        affiliateLinks: { include: { product: true } },
        commissions: { include: { product: true, order: true } },
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

    const linksWithConversions = affiliate.affiliateLinks.map((link) => ({
      ...link,
      conversions: linkConversions[link.id] || 0,
    }));

    // Calculate stats
    const totalClicks = linksWithConversions.reduce(
      (sum, link) => sum + link.clicks,
      0,
    );

    const totalConversions = affiliate.referrals.length;

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

    // Get approved commissions
    const approvedCommissions = await this.prisma.commission.findMany({
      where: {
        affiliateId: affiliate.id,
        status: "APPROVED",
      },
    });

    const totalApproved = approvedCommissions.reduce(
      (sum, c) => sum + c.amount,
      0,
    );

    // Get all withdrawals already reserved or paid
    const outstandingRequests = await this.prisma.withdrawalRequest.aggregate({
      where: {
        affiliateId: affiliate.id,
        status: {
          in: ["PENDING", "APPROVED", "COMPLETED"],
        },
      },
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
