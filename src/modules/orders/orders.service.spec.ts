import { OrdersService } from "./orders.service";
import { NotFoundException, BadRequestException } from "@nestjs/common";

describe("OrdersService", () => {
  let service: OrdersService;
  const mockPrisma: any = {
    product: {
      findUnique: jest.fn(),
    },
    order: {
      create: jest.fn(),
    },
    paymentSplit: {
      createMany: jest.fn(),
    },
    referral: {
      create: jest.fn(),
    },
    affiliateLink: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    affiliateCommission: {
      findUnique: jest.fn(),
    },
    commission: {
      create: jest.fn(),
    },
  };

  beforeEach(() => {
    service = new OrdersService(mockPrisma as any);
    jest.clearAllMocks();
  });

  it("should throw when the product does not exist", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);

    await expect(
      service.createOrder("user-1", {
        items: [{ productId: "product-1", quantity: 1 }],
        shippingAddress: "123 Market St",
        shippingCity: "Lagos",
        shippingState: "Lagos",
        shippingCountry: "NG",
        shippingZipCode: "100001",
      } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it("should throw when the product stock is insufficient", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      id: "product-1",
      name: "Test",
      price: 100,
      stock: 0,
    });

    await expect(
      service.createOrder("user-1", {
        items: [{ productId: "product-1", quantity: 1 }],
        shippingAddress: "123 Market St",
        shippingCity: "Lagos",
        shippingState: "Lagos",
        shippingCountry: "NG",
        shippingZipCode: "100001",
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it("should create an order with sellerId on each item", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      id: "product-1",
      name: "Test Product",
      price: 100,
      stock: 5,
      sellerId: "seller-123",
    });
    mockPrisma.order.create.mockResolvedValue({
      id: "order-1",
      items: [{ id: "item-1", sellerId: "seller-123" }],
    });

    const order = await service.createOrder("user-1", {
      items: [{ productId: "product-1", quantity: 2 }],
      shippingAddress: "123 Market St",
      shippingCity: "Lagos",
      shippingState: "Lagos",
      shippingCountry: "NG",
      shippingZipCode: "100001",
    } as any);

    expect(mockPrisma.order.create).toHaveBeenCalledTimes(1);
    expect(
      mockPrisma.order.create.mock.calls[0][0].data.items.create[0].sellerId,
    ).toBe("seller-123");
    expect(order).toEqual({
      id: "order-1",
      paymentOrderId: "order-1",
      subtotal: 200,
      shippingFee: 3500,
      tax: 0,
      total: 3700,
    });
  });

  it("should create payment splits for each seller when an order contains products from multiple sellers", async () => {
    mockPrisma.product.findUnique
      .mockResolvedValueOnce({
        id: "product-1",
        name: "Product A",
        price: 100,
        stock: 5,
        sellerId: "seller-1",
      })
      .mockResolvedValueOnce({
        id: "product-2",
        name: "Product B",
        price: 200,
        stock: 5,
        sellerId: "seller-2",
      });
    mockPrisma.order.create.mockResolvedValue({ id: "order-1", items: [] });
    mockPrisma.paymentSplit.createMany.mockResolvedValue([]);

    await service.createOrder("user-1", {
      items: [
        { productId: "product-1", quantity: 1 },
        { productId: "product-2", quantity: 2 },
      ],
      shippingAddress: "123 Market St",
      shippingCity: "Lagos",
      shippingState: "Lagos",
      shippingCountry: "NG",
      shippingZipCode: "100001",
    } as any);

    expect(mockPrisma.paymentSplit.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          orderId: "order-1",
          sellerId: "seller-1",
          amount: 100,
          currency: "NGN",
        }),
        expect.objectContaining({
          orderId: "order-1",
          sellerId: "seller-2",
          amount: 400,
          currency: "NGN",
        }),
      ],
    });
  });

  it("should calculate shipping fee per distinct seller", async () => {
    mockPrisma.product.findUnique
      .mockResolvedValueOnce({
        id: "product-1",
        name: "Product A",
        price: 100,
        stock: 5,
        sellerId: "seller-1",
      })
      .mockResolvedValueOnce({
        id: "product-2",
        name: "Product B",
        price: 200,
        stock: 5,
        sellerId: "seller-2",
      });
    mockPrisma.order.create.mockResolvedValue({ id: "order-1", items: [] });
    mockPrisma.paymentSplit.createMany.mockResolvedValue([]);

    await service.createOrder("user-1", {
      items: [
        { productId: "product-1", quantity: 1 },
        { productId: "product-2", quantity: 2 },
      ],
      shippingAddress: "123 Market St",
      shippingCity: "Lagos",
      shippingState: "Lagos",
      shippingCountry: "NG",
      shippingZipCode: "100001",
    } as any);

    expect(mockPrisma.order.create.mock.calls[0][0].data.shippingFee).toBe(
      7000,
    );
    expect(mockPrisma.order.create.mock.calls[0][0].data.total).toBe(7500);
  });

  it("should record commissions per affiliate link when a cart contains items tied to different affiliate codes", async () => {
    mockPrisma.product.findUnique
      .mockResolvedValueOnce({
        id: "product-1",
        name: "Product A",
        price: 100,
        stock: 5,
        sellerId: "seller-1",
      })
      .mockResolvedValueOnce({
        id: "product-2",
        name: "Product B",
        price: 200,
        stock: 5,
        sellerId: "seller-2",
      });
    mockPrisma.order.create.mockResolvedValue({ id: "order-1", items: [] });
    mockPrisma.paymentSplit.createMany.mockResolvedValue([]);
    mockPrisma.affiliateLink.findUnique
      .mockResolvedValueOnce({
        id: "link-1",
        affiliateId: "affiliate-1",
        productId: "product-1",
        code: "code-a",
      })
      .mockResolvedValueOnce({
        id: "link-2",
        affiliateId: "affiliate-2",
        productId: "product-2",
        code: "code-b",
      });
    mockPrisma.affiliateCommission.findUnique
      .mockResolvedValueOnce({ percentage: 10 })
      .mockResolvedValueOnce({ percentage: 5 });

    await service.createOrder("user-1", {
      items: [
        { productId: "product-1", quantity: 1, affiliateCode: "code-a" },
        { productId: "product-2", quantity: 1, affiliateCode: "code-b" },
      ],
      shippingAddress: "123 Market St",
      shippingCity: "Lagos",
      shippingState: "Lagos",
      shippingCountry: "NG",
      shippingZipCode: "100001",
    } as any);

    expect(mockPrisma.referral.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.commission.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.commission.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          affiliateId: "affiliate-1",
          amount: 10,
          percentage: 10,
        }),
      }),
    );
    expect(mockPrisma.commission.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          affiliateId: "affiliate-2",
          amount: 10,
          percentage: 5,
        }),
      }),
    );
  });
});
