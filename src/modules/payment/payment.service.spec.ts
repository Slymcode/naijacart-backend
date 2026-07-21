import axios from "axios";
import { PaymentService } from "./payment.service";

jest.mock("axios");

describe("PaymentService", () => {
  let service: PaymentService;
  const mockPrisma: any = {
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    commission: {
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    affiliate: {
      update: jest.fn(),
    },
    paymentSplit: {
      findMany: jest.fn(),
    },
    paymentSplit: {
      update: jest.fn(),
    },
    cartItem: {
      deleteMany: jest.fn(),
    },
  };

  beforeEach(() => {
    service = new PaymentService(mockPrisma as any);
    jest.clearAllMocks();
    process.env.PAYSTACK_SECRET_KEY = "secret";
  });

  it("credits each affiliate for the commissions attached to the order", async () => {
    mockPrisma.order.findUnique.mockResolvedValueOnce({
      id: "order-1",
      userId: "user-1",
      paymentStatus: "PENDING",
      items: [{ productId: "product-1" }],
    });
    mockPrisma.order.update.mockResolvedValue({});
    mockPrisma.commission.updateMany.mockResolvedValue({});
    mockPrisma.commission.findMany.mockResolvedValue([
      { affiliateId: "affiliate-1", amount: 40, status: "APPROVED" },
      { affiliateId: "affiliate-2", amount: 60, status: "APPROVED" },
    ]);
    mockPrisma.paymentSplit.findMany.mockResolvedValue([]);
    mockPrisma.cartItem.deleteMany.mockResolvedValue({});
    (axios.get as jest.Mock).mockResolvedValue({
      data: {
        status: true,
        data: {
          status: "success",
          metadata: { orderId: "order-1" },
          amount: 10000,
        },
      },
    });

    await service.verifyPayment({ reference: "ref-1" } as any);

    expect(mockPrisma.affiliate.update).toHaveBeenCalledTimes(2);
    expect(mockPrisma.affiliate.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { id: "affiliate-1" } }),
    );
    expect(mockPrisma.affiliate.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { id: "affiliate-2" } }),
    );
  });
});
