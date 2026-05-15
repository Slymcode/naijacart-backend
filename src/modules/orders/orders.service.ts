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
      affiliateCode,
    } = createOrderDto;

    // Fetch all products and calculate totals
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }

      if (product.stock < item.quantity) {
        throw new BadRequestException(`Insufficient stock for ${product.name}`);
      }

      subtotal += product.price * item.quantity;
      orderItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
        name: product.name,
      });
    }

    // Calculate shipping and remove VAT
    const shippingFee = 3500; // ₦3500 flat shipping
    const tax = 0;
    const total = subtotal + shippingFee;

    // Create order
    const order = await this.prisma.order.create({
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
          create: orderItems,
        },
      },
      include: { items: true },
    });

    // Handle affiliate referral if code provided
    if (affiliateCode) {
      const affiliateLink = await this.prisma.affiliateLink.findUnique({
        where: { code: affiliateCode },
      });

      if (affiliateLink) {
        // Create referral record
        await this.prisma.referral.create({
          data: {
            orderId: order.id,
            affiliateId: affiliateLink.affiliateId,
            source: affiliateCode,
          },
        });

        const affiliateCommission =
          await this.prisma.affiliateCommission.findUnique({
            where: { productId: affiliateLink.productId },
          });

        const commissionPercentage = affiliateCommission?.percentage;

        if (commissionPercentage && commissionPercentage > 0) {
          const commissionAmount =
            Math.round(subtotal * (commissionPercentage / 100) * 100) / 100;

          await this.prisma.commission.create({
            data: {
              affiliateId: affiliateLink.affiliateId,
              orderId: order.id,
              amount: commissionAmount,
              percentage: commissionPercentage,
            },
          });
        }
      }
    }

    return order;
  }

  async getOrder(orderId: string, userId?: string) {
    const where: any = { id: orderId };
    if (userId) {
      where.userId = userId;
    }

    return this.prisma.order.findFirst({
      where,
      include: { items: { include: { product: true } } },
    });
  }

  async getUserOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { items: { include: { product: true } } },
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
