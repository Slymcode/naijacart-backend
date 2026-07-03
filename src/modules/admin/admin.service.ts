import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import * as bcrypt from "bcrypt";

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async createAdmin(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ) {
    const existingAdmin = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingAdmin) {
      throw new BadRequestException("Email already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    return this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: "ADMIN",
      },
    });
  }

  async getDashboardStats() {
    const [
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
      pendingOrders,
      totalAffiliates,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: "CUSTOMER" } }),
      this.prisma.product.count({ where: { isActive: true } }),
      this.prisma.order.count(),
      this.prisma.order.aggregate({
        where: { paymentStatus: "COMPLETED" },
        _sum: { total: true },
      }),
      this.prisma.order.count({ where: { status: "PENDING" } }),
      this.prisma.affiliate.count(),
    ]);

    return {
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue: totalRevenue._sum.total || 0,
      pendingOrders,
      totalAffiliates,
    };
  }

  async getOrderAnalytics(skip = 0, take = 10) {
    const orders = await this.prisma.order.findMany({
      skip,
      take,
      include: { user: true, items: true },
      orderBy: { createdAt: "desc" },
    });

    return orders;
  }

  async getProductAnalytics() {
    return this.prisma.product.findMany({
      include: { productMetrics: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async getAffiliateAnalytics() {
    return this.prisma.affiliate.findMany({
      include: {
        user: true,
        affiliateLinks: true,
        commissions: true,
        referrals: true,
      },
      orderBy: { totalEarnings: "desc" },
    });
  }

  async getPlatformAccount() {
    let account = await this.prisma.platformAccount.findFirst();
    if (!account) {
      account = await this.prisma.platformAccount.create({
        data: { balance: 0 },
      });
    }
    return account;
  }

  async getWithdrawalRequests() {
    return this.prisma.withdrawalRequest.findMany({
      include: {
        user: true,
        affiliate: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async approveWithdrawal(withdrawalId: string) {
    return this.prisma.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: { status: "APPROVED" },
    });
  }

  async completeWithdrawal(withdrawalId: string) {
    const withdrawal = await this.prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new BadRequestException("Withdrawal not found");
    }

    // Update withdrawal status
    await this.prisma.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: { status: "COMPLETED" },
    });

    // Update affiliate earnings
    await this.prisma.affiliate.update({
      where: { id: withdrawal.affiliateId },
      data: {
        totalEarnings: {
          decrement: withdrawal.amount,
        },
        pendingEarnings: {
          decrement: withdrawal.amount,
        },
      },
    });

    return withdrawal;
  }

  async rejectWithdrawal(withdrawalId: string) {
    return this.prisma.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: { status: "REJECTED" },
    });
  }

  async setAffiliateCommission(productId: string, percentage: number) {
    const roundedPercentage = Math.round(percentage * 100) / 100;

    return this.prisma.affiliateCommission.upsert({
      where: { productId },
      create: { productId, percentage: roundedPercentage },
      update: { percentage: roundedPercentage },
    });
  }

  async getAffiliateCommissions() {
    return this.prisma.affiliateCommission.findMany();
  }
}
