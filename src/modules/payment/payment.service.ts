import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { InitializePaymentDto, VerifyPaymentDto } from "./dto/payment.dto";
import { OrderStatus, PaymentStatus, CommissionStatus } from "@prisma/client";
import axios from "axios";

@Injectable()
export class PaymentService {
  private readonly paystackBaseUrl = "https://api.paystack.co";
  private readonly paystackSecret = process.env.PAYSTACK_SECRET_KEY;

  constructor(private prisma: PrismaService) {}

  private ensurePaystackKey() {
    if (!this.paystackSecret) {
      throw new InternalServerErrorException(
        "Paystack secret key is not configured",
      );
    }
  }

  async initializePayment(initializePaymentDto: InitializePaymentDto) {
    const { orderId, email, amount } = initializePaymentDto;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new BadRequestException("Order not found");
    }

    if (order.paymentStatus !== PaymentStatus.PENDING) {
      throw new BadRequestException("Order is not pending payment");
    }

    this.ensurePaystackKey();

    try {
      const response = await axios.post(
        `${this.paystackBaseUrl}/transaction/initialize`,
        {
          email,
          amount: Math.round(amount * 100), // Convert to kobo
          metadata: {
            orderId,
            orderNumber: order.orderNumber,
          },
          callback_url: "http://localhost:5173/payment/callback",
        },
        {
          headers: {
            Authorization: `Bearer ${this.paystackSecret}`,
          },
        },
      );

      return {
        authorizationUrl: response.data.data.authorization_url,
        accessCode: response.data.data.access_code,
        reference: response.data.data.reference,
      };
    } catch (error) {
      throw new InternalServerErrorException("Failed to initialize payment");
    }
  }

  async verifyPayment(verifyPaymentDto: VerifyPaymentDto) {
    const { reference } = verifyPaymentDto;

    this.ensurePaystackKey();

    try {
      const response = await axios.get(
        `${this.paystackBaseUrl}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.paystackSecret}`,
          },
        },
      );

      const { status, data } = response.data;
      const success = status === true && data?.status === "success";

      if (!success) {
        return {
          success: false,
          message: "Payment verification failed",
        };
      }

      const orderId = data.metadata?.orderId;
      if (!orderId) {
        throw new BadRequestException("Payment metadata is missing order ID");
      }

      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) {
        throw new BadRequestException("Order not found");
      }

      if (order.paymentStatus === PaymentStatus.COMPLETED) {
        return {
          success: true,
          message: "Payment has already been verified",
          orderId,
          amount: data.amount / 100,
        };
      }

      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: PaymentStatus.COMPLETED,
          paymentReference: reference,
          status: OrderStatus.PROCESSING,
        },
      });

      await this.prisma.commission.updateMany({
        where: { orderId },
        data: { status: CommissionStatus.APPROVED },
      });

      // Update affiliate pending earnings
      const approvedCommissions = await this.prisma.commission.findMany({
        where: { orderId, status: CommissionStatus.APPROVED },
      });
      const totalCommission = approvedCommissions.reduce(
        (sum, c) => sum + c.amount,
        0,
      );
      if (totalCommission > 0 && approvedCommissions.length > 0) {
        const affiliateId = approvedCommissions[0].affiliateId;
        await this.prisma.affiliate.update({
          where: { id: affiliateId },
          data: {
            pendingEarnings: {
              increment: totalCommission,
            },
          },
        });
      }

      for (const item of order.items ?? []) {
        await this.prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      return {
        success: true,
        message: "Payment verified successfully",
        orderId,
        amount: data.amount / 100,
      };
    } catch (error) {
      throw new InternalServerErrorException("Failed to verify payment");
    }
  }

  async getPaymentHistory(userId: string, skip = 0, take = 10) {
    const parsedSkip = Number(skip) || 0;
    const parsedTake = Number(take) || 10;

    return this.prisma.order.findMany({
      where: { userId, paymentStatus: PaymentStatus.COMPLETED },
      skip: parsedSkip,
      take: parsedTake,
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
  }
}
