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

    // total sales across order items for this seller
    const salesAgg = await this.prisma.orderItem.aggregate({
      where: { sellerId: seller.id },
      _sum: { price: true },
      _count: { id: true },
    });

    return {
      ...seller,
      totalProducts,
      totalSales: salesAgg._sum.price || 0,
      totalOrders: salesAgg._count.id || 0,
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

    const orders = Object.values(ordersMap);
    return { data: orders, total, page: Number.isInteger(page) ? page : 0 };
  }

  async getAnalyticsForSellerByUser(userId: string) {
    const seller = await this.prisma.seller.findUnique({ where: { userId } });
    if (!seller) return null;

    const salesAgg = await this.prisma.orderItem.aggregate({
      where: { sellerId: seller.id },
      _sum: { price: true },
      _count: { id: true },
    });

    const topProducts = await this.prisma.product.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return {
      totalSales: salesAgg._sum.price || 0,
      totalOrders: salesAgg._count.id || 0,
      topProducts,
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
}
