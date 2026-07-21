import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSellerDto } from "./dto/create-seller.dto";
import { UpdateSellerDto } from "./dto/update-seller.dto";

@Injectable()
export class SellersService {
  constructor(private prisma: PrismaService) {}

  private generateHandleFromName(name: string) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async createSeller(userId: string, data: CreateSellerDto) {
    // Prevent creating multiple seller records for the same user
    const existingForUser = await this.prisma.seller.findUnique({
      where: { userId },
    });
    if (existingForUser) {
      throw new BadRequestException(
        "Seller account already exists for this user",
      );
    }
    const baseHandle =
      data.handle?.trim() || this.generateHandleFromName(data.businessName);
    let handle = baseHandle;
    let suffix = 1;

    while (await this.prisma.seller.findUnique({ where: { handle } })) {
      handle = `${baseHandle}-${suffix++}`;
    }

    const seller = await this.prisma.seller.create({
      data: {
        userId,
        businessName: data.businessName,
        handle,
        slug: handle,
        email: data.email,
        phone: data.phone,
        description: data.description,
        logo: data.logo,
        socialLinks: data.socialLinks,
        policies: data.policies,
        status: "pending",
      },
    });

    return seller;
  }

  async getSellerByHandle(handle: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { handle },
      include: { products: true },
    });

    if (!seller) {
      return null;
    }

    const totalProducts = await this.prisma.product.count({
      where: { sellerId: seller.id },
    });

    // total sales across order items for this seller (sum price * quantity)
    const saleItems = await this.prisma.orderItem.findMany({
      where: { sellerId: seller.id },
      select: { price: true, quantity: true, orderId: true },
    });

    const totalSales = saleItems.reduce(
      (sum, it) => sum + (it.price || 0) * (it.quantity || 0),
      0,
    );

    const totalOrders = new Set(saleItems.map((it) => it.orderId)).size;

    return {
      ...seller,
      totalProducts,
      totalSales,
      totalOrders,
    };
  }

  async updateSeller(
    id: string,
    userId: string,
    userRole: string,
    data: UpdateSellerDto,
  ) {
    const existing = await this.prisma.seller.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Seller not found");

    // Only admin or owner can update
    if (userRole !== "ADMIN" && existing.userId !== userId) {
      throw new ForbiddenException("Not authorized to update seller");
    }

    // If handle changed, ensure uniqueness
    if (data.handle && data.handle !== existing.handle) {
      const check = await this.prisma.seller.findUnique({
        where: { handle: data.handle },
      });
      if (check) throw new BadRequestException("Handle already in use");
    }

    return this.prisma.seller.update({ where: { id }, data });
  }

  async listSellers(filters: any = {}) {
    const page = Number(filters?.page);
    const limit = Number(filters?.limit);
    const skip =
      (Number.isInteger(page) ? page : 0) *
      (Number.isInteger(limit) ? limit : 12);
    const take = Number.isInteger(limit) ? limit : 12;

    const where: any = {};
    if (filters?.search) {
      where.OR = [
        { businessName: { contains: filters.search, mode: "insensitive" } },
        { handle: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.seller.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.seller.count({ where }),
    ]);

    return { data, total, page: Number.isInteger(page) ? page : 0 };
  }

  async getOrdersForSellerByUser(userId: string, filters: any = {}) {
    const seller = await this.prisma.seller.findUnique({ where: { userId } });
    if (!seller) return { data: [], total: 0, page: 0 };

    const page = Number(filters?.page);
    const limit = Number(filters?.limit);
    const skip =
      (Number.isInteger(page) ? page : 0) *
      (Number.isInteger(limit) ? limit : 20);
    const take = Number.isInteger(limit) ? limit : 20;

    const [items, total] = await Promise.all([
      this.prisma.orderItem.findMany({
        where: { sellerId: seller.id },
        skip,
        take,
        include: { order: true, product: true },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.orderItem.count({ where: { sellerId: seller.id } }),
    ]);

    // Group by order
    const ordersMap: Record<string, any> = {};
    for (const it of items) {
      if (!ordersMap[it.orderId]) {
        ordersMap[it.orderId] = { order: it.order, items: [] };
      }
      ordersMap[it.orderId].items.push(it);
    }

    const orders = Object.values(ordersMap).map((group) => {
      const itemTotal = group.items.reduce(
        (sum: number, item: any) => sum + item.price * item.quantity,
        0,
      );
      return {
        ...group,
        sellerTotal: itemTotal + 3500,
      };
    });
    return { data: orders, total, page: Number.isInteger(page) ? page : 0 };
  }

  async getAnalyticsForSellerByUser(userId: string) {
    const seller = await this.prisma.seller.findUnique({ where: { userId } });
    if (!seller) return null;

    const [
      salesAgg,
      recentOrders,
      topProducts,
      payoutRequests,
      sellerProducts,
    ] = await Promise.all([
      this.prisma.orderItem.findMany({
        where: { sellerId: seller.id },
        select: { price: true, quantity: true, orderId: true },
      }),
      this.prisma.orderItem.findMany({
        where: { sellerId: seller.id },
        include: { order: true, product: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      this.prisma.product.findMany({
        where: { sellerId: seller.id },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      this.prisma.payoutRequest.findMany({
        where: { sellerId: seller.id },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      this.prisma.product.findMany({
        where: { sellerId: seller.id },
        select: { id: true },
      }),
    ]);

    const sellerProductIds = sellerProducts.map((product: any) => product.id);
    const affiliateIds = sellerProductIds.length
      ? (
          await this.prisma.affiliateLink.findMany({
            where: { productId: { in: sellerProductIds } },
            select: { affiliateId: true },
          })
        ).map((link: any) => link.affiliateId)
      : [];

    const pendingAffiliatePayouts = affiliateIds.length
      ? (
          await this.prisma.withdrawalRequest.findMany({
            where: {
              affiliateId: { in: affiliateIds },
              status: "PENDING",
            },
          })
        ).reduce((sum, item) => sum + item.amount, 0)
      : 0;

    // salesAgg is now an array of items; compute totalSales and distinct orders
    const totalSales = (salesAgg as any[]).reduce(
      (sum, it: any) => sum + (it.price || 0) * (it.quantity || 0),
      0,
    );
    const totalOrders = new Set(
      (salesAgg as any[]).map((it: any) => it.orderId),
    ).size;

    return {
      totalSales,
      totalOrders,
      topProducts,
      recentOrderItems: recentOrders,
      payoutRequests,
      pendingAffiliatePayouts,
    };
  }

  async getAffiliateLinksForSeller(userId: string, filters: any = {}) {
    const seller = await this.prisma.seller.findUnique({ where: { userId } });
    if (!seller) return { data: [], total: 0, page: 0 };

    const page = Number(filters?.page);
    const limit = Number(filters?.limit);
    const skip =
      (Number.isInteger(page) ? page : 0) *
      (Number.isInteger(limit) ? limit : 20);
    const take = Number.isInteger(limit) ? limit : 20;

    const sellerProducts = await this.prisma.product.findMany({
      where: { sellerId: seller.id },
      select: { id: true },
    });
    const productIds = sellerProducts.map((product: any) => product.id);
    if (productIds.length === 0) {
      return { data: [], total: 0, page: Number.isInteger(page) ? page : 0 };
    }

    const [data, total] = await Promise.all([
      this.prisma.affiliateLink.findMany({
        where: { productId: { in: productIds } },
        include: {
          product: true,
          affiliate: { include: { user: true } },
        },
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.affiliateLink.count({
        where: { productId: { in: productIds } },
      }),
    ]);

    // Compute conversions per link from completed orders and recorded referrals
    const conversionsByLinkId = new Map<string, number>();
    await Promise.all(
      data.map(async (link: any) => {
        // Count direct item purchases with this affiliate code on completed orders
        const directItems = await this.prisma.orderItem.findMany({
          where: {
            affiliateCode: link.code,
            order: { paymentStatus: "COMPLETED" },
          },
          select: { quantity: true },
        });

        const conversions = (directItems || []).reduce(
          (sum, it) => sum + (it.quantity || 0),
          0,
        );

        conversionsByLinkId.set(link.id, conversions);
      }),
    );

    return {
      data: data.map((link: any) => ({
        ...link,
        affiliateName: link.affiliate?.user
          ? `${link.affiliate.user.firstName} ${link.affiliate.user.lastName}`
          : undefined,
        conversions: conversionsByLinkId.get(link.id) || 0,
      })),
      total,
      page: Number.isInteger(page) ? page : 0,
    };
  }

  // Admin functions
  async adminListSellers(filters: any = {}) {
    const page = Number(filters?.page);
    const limit = Number(filters?.limit);
    const skip =
      (Number.isInteger(page) ? page : 0) *
      (Number.isInteger(limit) ? limit : 20);
    const take = Number.isInteger(limit) ? limit : 20;
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        { businessName: { contains: filters.search, mode: "insensitive" } },
        { handle: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.seller.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.seller.count({ where }),
    ]);

    return { data, total, page: Number.isInteger(page) ? page : 0 };
  }

  async adminUpdateSellerStatus(id: string, status: string) {
    return this.prisma.seller.update({ where: { id }, data: { status } });
  }

  async adminSetSellerVerified(id: string, isVerified: boolean) {
    return this.prisma.seller.update({ where: { id }, data: { isVerified } });
  }

  // Payouts
  async createPayoutRequestForSeller(
    userId: string,
    data: { amount: number; note?: string },
  ) {
    const seller = await this.prisma.seller.findUnique({ where: { userId } });
    if (!seller) throw new Error("Seller not found");

    const pr = await this.prisma.payoutRequest.create({
      data: {
        sellerId: seller.id,
        amount: data.amount,
        note: data.note,
        status: "PENDING",
      },
    });

    return pr;
  }

  async adminListPayouts(filters: any = {}) {
    const page = Number(filters?.page);
    const limit = Number(filters?.limit);
    const skip =
      (Number.isInteger(page) ? page : 0) *
      (Number.isInteger(limit) ? limit : 20);
    const take = Number.isInteger(limit) ? limit : 20;
    const where: any = {};
    if (filters?.status) where.status = filters.status;

    const [data, total] = await Promise.all([
      this.prisma.payoutRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { seller: true },
      }),
      this.prisma.payoutRequest.count({ where }),
    ]);

    return { data, total, page: Number.isInteger(page) ? page : 0 };
  }

  async adminUpdatePayoutStatus(
    id: string,
    status: string,
    processedBy?: string,
  ) {
    return this.prisma.payoutRequest.update({
      where: { id },
      data: { status: status as any, processedBy },
    });
  }

  async getAffiliatePayoutRequestsForSeller(userId: string) {
    const seller = await this.prisma.seller.findUnique({ where: { userId } });
    if (!seller) return [];

    const sellerProducts = await this.prisma.product.findMany({
      where: { sellerId: seller.id },
      select: { id: true, name: true },
    });

    const productIds = sellerProducts.map((product: any) => product.id);

    if (productIds.length === 0) {
      return [];
    }

    const affiliateLinks = await this.prisma.affiliateLink.findMany({
      where: { productId: { in: productIds } },
      include: { product: true },
    });

    const withdrawals = await this.prisma.withdrawalRequest.findMany({
      where: {
        affiliateId: {
          in: affiliateLinks.map((link: any) => link.affiliateId),
        },
      },
      orderBy: { createdAt: "desc" },
      include: { affiliate: true, user: true },
    });

    return withdrawals.map((withdrawal: any) => ({
      ...withdrawal,
      relatedProducts: affiliateLinks
        .filter((link: any) => link.affiliateId === withdrawal.affiliateId)
        .map((link: any) => link.product),
    }));
  }

  async updateAffiliateWithdrawalStatusForSeller(
    userId: string,
    withdrawalId: string,
    status: string,
  ) {
    const seller = await this.prisma.seller.findUnique({ where: { userId } });
    if (!seller) throw new NotFoundException("Seller not found");

    const sellerProducts = await this.prisma.product.findMany({
      where: { sellerId: seller.id },
      select: { id: true },
    });
    const productIds = sellerProducts.map((p: any) => p.id);

    if (productIds.length === 0) {
      throw new BadRequestException("No products for seller");
    }

    const affiliateLinks = await this.prisma.affiliateLink.findMany({
      where: { productId: { in: productIds } },
    });
    const allowedAffiliateIds = new Set(
      affiliateLinks.map((l: any) => l.affiliateId),
    );

    const withdrawal = await this.prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
    });
    if (!withdrawal)
      throw new NotFoundException("Withdrawal request not found");

    if (!allowedAffiliateIds.has(withdrawal.affiliateId)) {
      throw new ForbiddenException("Not authorized to manage this withdrawal");
    }

    return this.prisma.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: { status: status as any },
    });
  }
}
