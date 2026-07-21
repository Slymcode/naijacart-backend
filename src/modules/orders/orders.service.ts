import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOrderDto, UpdateOrderStatusDto } from "./dto/order.dto";
import { OrderStatus, PaymentStatus } from "@prisma/client";

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async createOrder(userId: string, createOrderDto: CreateOrderDto) {
    const {
      items,
      shippingAddress,
      shippingCity,
      shippingState,
      shippingCountry,
      shippingZipCode,
    } = createOrderDto;

    const sellerGroups = new Map<string, Array<any>>();
    let subtotal = 0;
    const checkoutItems = [] as Array<any>;
    const productCache = new Map<string, any>();

    for (const item of items) {
      let product = productCache.get(item.productId);

      if (!product) {
        product = await this.prisma.product.findUnique({
          where: { id: item.productId },
        });
        productCache.set(item.productId, product);
      }

      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }

      if (product.stock < item.quantity) {
        throw new BadRequestException(`Insufficient stock for ${product.name}`);
      }

      const sellerKey = product.sellerId || "marketplace";
      const normalizedItemAffiliateCode = item.affiliateCode?.trim() || null;
      const sellerItem = {
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
        name: product.name,
        sellerId: product.sellerId || null,
        affiliateCode: normalizedItemAffiliateCode,
      };

      subtotal += product.price * item.quantity;
      checkoutItems.push(sellerItem);

      const groupItems = sellerGroups.get(sellerKey) || [];
      groupItems.push(sellerItem);
      sellerGroups.set(sellerKey, groupItems);
    }

    const SHIPPING_FEE_PER_SELLER = 3500;
    const sellerCount = sellerGroups.size;
    const shippingFee = SHIPPING_FEE_PER_SELLER * Math.max(1, sellerCount);
    const tax = 0;
    const total = subtotal + shippingFee;

    const checkoutOrder = await this.prisma.order.create({
      data: {
        userId,
        orderNumber: `ORD-${Date.now()}`,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        subtotal,
        shippingFee,
        tax,
        total,
        shippingAddress,
        shippingCity,
        shippingState,
        shippingCountry,
        shippingZipCode,
        items: {
          create: checkoutItems,
        },
      },
      include: { items: true },
    });

    const splitData = Array.from(sellerGroups.entries())
      .filter(([, groupItems]) => groupItems.length > 0)
      .map(([sellerKey, groupItems]) => ({
        orderId: checkoutOrder.id,
        sellerId: sellerKey === "marketplace" ? null : sellerKey,
        amount: groupItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0,
        ),
        currency: "NGN",
      }));

    if (splitData.length > 0) {
      await this.prisma.paymentSplit.createMany({
        data: splitData,
      });
    }

    const affiliateEntries = [] as Array<{
      affiliateId: string;
      code: string;
      amount: number;
      percentage: number;
    }>;
    const affiliateCodeUsage = new Map<string, number>();

    for (const item of items) {
      // Only consider per-item affiliate codes. Do NOT fallback to a
      // request-level `affiliateCode` — that would attribute commissions to
      // items added directly during checkout. This enforces: only items
      // explicitly added with an affiliate link receive commission.
      const itemAffiliateCode = item.affiliateCode?.trim();

      if (!itemAffiliateCode) {
        continue;
      }

      const affiliateLink = await this.prisma.affiliateLink.findUnique({
        where: { code: itemAffiliateCode },
      });

      if (!affiliateLink) {
        continue;
      }

      const affiliateCommission =
        await this.prisma.affiliateCommission.findUnique({
          where: { productId: affiliateLink.productId },
        });

      const commissionPercentage = affiliateCommission?.percentage;

      if (!commissionPercentage || commissionPercentage <= 0) {
        continue;
      }

      let product = productCache.get(item.productId);

      if (!product) {
        product = await this.prisma.product.findUnique({
          where: { id: item.productId },
        });
        productCache.set(item.productId, product);
      }

      if (!product) {
        continue;
      }

      const lineSubtotal = product.price * item.quantity;
      const commissionAmount =
        Math.round(lineSubtotal * (commissionPercentage / 100) * 100) / 100;

      affiliateEntries.push({
        affiliateId: affiliateLink.affiliateId,
        code: itemAffiliateCode,
        amount: commissionAmount,
        percentage: commissionPercentage,
      });
      affiliateCodeUsage.set(
        itemAffiliateCode,
        (affiliateCodeUsage.get(itemAffiliateCode) || 0) + 1,
      );
    }

    if (affiliateEntries.length > 0) {
      const uniqueAffiliateEntries = new Map<
        string,
        {
          affiliateId: string;
          totalAmount: number;
          weightedPercentage: number;
          firstCode: string;
        }
      >();

      for (const affiliateEntry of affiliateEntries) {
        const existingEntry = uniqueAffiliateEntries.get(
          affiliateEntry.affiliateId,
        );

        if (existingEntry) {
          existingEntry.totalAmount += affiliateEntry.amount;
          existingEntry.weightedPercentage +=
            affiliateEntry.amount * affiliateEntry.percentage;
          continue;
        }

        uniqueAffiliateEntries.set(affiliateEntry.affiliateId, {
          affiliateId: affiliateEntry.affiliateId,
          totalAmount: affiliateEntry.amount,
          weightedPercentage: affiliateEntry.amount * affiliateEntry.percentage,
          firstCode: affiliateEntry.code,
        });
      }

      const [firstAffiliateEntry] = Array.from(uniqueAffiliateEntries.values());

      if (firstAffiliateEntry) {
        await this.prisma.referral.create({
          data: {
            orderId: checkoutOrder.id,
            affiliateId: firstAffiliateEntry.affiliateId,
            source: firstAffiliateEntry.firstCode,
          },
        });
      }

      for (const affiliateEntry of uniqueAffiliateEntries.values()) {
        for (const [code, count] of affiliateCodeUsage.entries()) {
          if (
            affiliateEntries.some(
              (entry) =>
                entry.affiliateId === affiliateEntry.affiliateId &&
                entry.code === code,
            )
          ) {
            await this.prisma.affiliateLink.update({
              where: { code },
              data: { conversions: { increment: count } },
            });
          }
        }

        const averagePercentage =
          affiliateEntry.totalAmount > 0
            ? Math.round(
                (affiliateEntry.weightedPercentage /
                  affiliateEntry.totalAmount) *
                  100,
              ) / 100
            : 0;

        await this.prisma.commission.create({
          data: {
            affiliateId: affiliateEntry.affiliateId,
            orderId: checkoutOrder.id,
            amount: affiliateEntry.totalAmount,
            percentage: averagePercentage,
          },
        });
      }
    }

    return {
      id: checkoutOrder.id,
      paymentOrderId: checkoutOrder.id,
      subtotal,
      shippingFee,
      tax,
      total,
    };
  }

  async getOrder(orderId: string, userId?: string, sellerId?: string) {
    const where: any = { id: orderId };

    if (sellerId) {
      where.OR = [{ userId }, { items: { some: { sellerId } } }];
    } else if (userId) {
      where.userId = userId;
    }

    return this.prisma.order.findFirst({
      where,
      include: {
        items: {
          include: {
            product: {
              include: { seller: true },
            },
          },
        },
      },
    });
  }

  async getUserOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: { seller: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateOrderStatus(
    orderId: string,
    updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: updateOrderStatusDto.status },
    });
  }

  async updatePaymentStatus(
    orderId: string,
    paymentStatus: PaymentStatus,
    paymentReference?: string,
  ) {
    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus,
        paymentReference,
      },
    });
  }

  async getAllOrders(skip = 0, take = 10) {
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        skip,
        take,
        include: { items: true, user: true },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.order.count(),
    ]);

    return { data: orders, total };
  }
}
