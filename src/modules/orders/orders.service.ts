import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOrderDto, UpdateOrderStatusDto } from "./dto/order.dto";
import { OrderStatus, PaymentStatus, PaymentSplitStatus } from "@prisma/client";

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
      affiliateCode,
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
      const sellerItem = {
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
        name: product.name,
        sellerId: product.sellerId || null,
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
        status: PaymentSplitStatus.PENDING,
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

    for (const item of items) {
      const itemAffiliateCode = item.affiliateCode || affiliateCode;

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
    }

    if (affiliateEntries.length > 0) {
      const uniqueAffiliateEntries = new Map<
        string,
        (typeof affiliateEntries)[number]
      >();

      for (const affiliateEntry of affiliateEntries) {
        const existingEntry = uniqueAffiliateEntries.get(
          affiliateEntry.affiliateId,
        );

        if (existingEntry) {
          existingEntry.amount += affiliateEntry.amount;
          existingEntry.percentage = affiliateEntry.percentage;
          continue;
        }

        uniqueAffiliateEntries.set(affiliateEntry.affiliateId, affiliateEntry);
      }

      const [firstAffiliateEntry] = Array.from(uniqueAffiliateEntries.values());

      if (firstAffiliateEntry) {
        await this.prisma.referral.create({
          data: {
            orderId: checkoutOrder.id,
            affiliateId: firstAffiliateEntry.affiliateId,
            source: firstAffiliateEntry.code,
          },
        });
      }

      for (const affiliateEntry of uniqueAffiliateEntries.values()) {
        await this.prisma.affiliateLink.update({
          where: { code: affiliateEntry.code },
          data: { conversions: { increment: 1 } },
        });

        await this.prisma.commission.create({
          data: {
            affiliateId: affiliateEntry.affiliateId,
            orderId: checkoutOrder.id,
            amount: affiliateEntry.amount,
            percentage: affiliateEntry.percentage,
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
