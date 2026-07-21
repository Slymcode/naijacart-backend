import { SellersService } from "./sellers.service";
import { BadRequestException } from "@nestjs/common";

describe("SellersService", () => {
  let service: SellersService;
  const mockPrisma: any = {
    seller: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    product: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn(),
    },
    orderItem: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { price: 0 }, _count: { id: 0 } }),
      findMany: jest.fn(),
    },
    affiliateLink: {
      findMany: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    referral: {
      findMany: jest.fn(),
    },
    withdrawalRequest: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    payoutRequest: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(() => {
    service = new SellersService(mockPrisma as any);
    jest.clearAllMocks();
  });

  it("should throw if seller account already exists for the user", async () => {
    mockPrisma.seller.findUnique.mockResolvedValue({
      id: "s1",
      handle: "taken",
    });
    await expect(
      service.createSeller("u1", { businessName: "B", handle: "taken" } as any),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.seller.findUnique).toHaveBeenCalledWith({
      where: { userId: "u1" },
    });
  });

  it("should create a seller when handle is unique", async () => {
    mockPrisma.seller.findUnique.mockResolvedValue(null);
    mockPrisma.seller.create.mockResolvedValue({
      id: "s2",
      handle: "new",
      businessName: "New",
    });
    const res = await service.createSeller("u2", {
      businessName: "New",
      handle: "new",
    } as any);
    expect(res).toEqual({ id: "s2", handle: "new", businessName: "New" });
    expect(mockPrisma.seller.create).toHaveBeenCalled();
  });

  it("should create a payout request for the seller", async () => {
    mockPrisma.seller.findUnique.mockResolvedValue({ id: "seller-1" });
    mockPrisma.payoutRequest.create.mockResolvedValue({
      id: "payout-1",
      amount: 200,
      status: "PENDING",
      sellerId: "seller-1",
    });

    const result = await service.createPayoutRequestForSeller("user-1", {
      amount: 200,
      note: "First payout",
    });

    expect(result).toEqual({
      id: "payout-1",
      amount: 200,
      status: "PENDING",
      sellerId: "seller-1",
    });
    expect(mockPrisma.payoutRequest.create).toHaveBeenCalledWith({
      data: {
        sellerId: "seller-1",
        amount: 200,
        note: "First payout",
        status: "PENDING",
      },
    });
  });

  it("should throw when requesting payout for a nonexistent seller", async () => {
    mockPrisma.seller.findUnique.mockResolvedValue(null);

    await expect(
      service.createPayoutRequestForSeller("user-1", { amount: 100 } as any),
    ).rejects.toThrow("Seller not found");
  });

  it("should list admin payout requests", async () => {
    mockPrisma.payoutRequest.findMany.mockResolvedValue([
      { id: "payout-1", seller: { id: "seller-1", businessName: "Test" } },
    ]);
    mockPrisma.payoutRequest.count.mockResolvedValue(1);

    const result = await service.adminListPayouts({ page: 0, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(mockPrisma.payoutRequest.findMany).toHaveBeenCalled();
  });

  it("should update payout status and processedBy", async () => {
    mockPrisma.payoutRequest.update.mockResolvedValue({
      id: "payout-1",
      status: "APPROVED",
      processedBy: "admin-1",
    });

    const result = await service.adminUpdatePayoutStatus(
      "payout-1",
      "APPROVED",
      "admin-1",
    );

    expect(result).toEqual({
      id: "payout-1",
      status: "APPROVED",
      processedBy: "admin-1",
    });
    expect(mockPrisma.payoutRequest.update).toHaveBeenCalledWith({
      where: { id: "payout-1" },
      data: { status: "APPROVED", processedBy: "admin-1" },
    });
  });

  it("should list affiliate payout requests tied to the seller products", async () => {
    mockPrisma.seller.findUnique.mockResolvedValue({ id: "seller-1" });
    mockPrisma.product.findMany.mockResolvedValue([{ id: "product-1" }]);
    mockPrisma.affiliateLink.findMany.mockResolvedValue([
      {
        id: "link-1",
        affiliateId: "affiliate-1",
        productId: "product-1",
        product: { id: "product-1", name: "Product 1" },
        code: "AFF-1",
      },
    ]);
    mockPrisma.withdrawalRequest.findMany.mockResolvedValue([
      {
        id: "wr-1",
        amount: 100,
        status: "PENDING",
        affiliateId: "affiliate-1",
        affiliate: { id: "affiliate-1" },
        user: { id: "user-1", firstName: "Jane", lastName: "Doe" },
      },
    ]);

    const result = await service.getAffiliatePayoutRequestsForSeller("user-1");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "wr-1", amount: 100 });
    expect(result[0].relatedProducts).toHaveLength(1);
  });

  it("should list affiliate links with product and affiliate details for the seller", async () => {
    mockPrisma.seller.findUnique.mockResolvedValue({ id: "seller-1" });
    mockPrisma.product.findMany.mockResolvedValue([
      { id: "product-1", name: "Fine Hair" },
    ]);
    mockPrisma.affiliateLink.findMany.mockResolvedValue([
      {
        id: "link-1",
        code: "AFF-100",
        clicks: 3,
        conversions: 1,
        affiliateId: "affiliate-1",
        productId: "product-1",
        affiliate: {
          id: "affiliate-1",
          code: "AFF-100",
          user: { id: "user-1", firstName: "Jane", lastName: "Doe" },
        },
        product: { id: "product-1", name: "Fine Hair" },
      },
    ]);
    mockPrisma.orderItem.findMany.mockResolvedValue([{ quantity: 1 }]);

    const result = await service.getAffiliateLinksForSeller("user-1", {
      limit: 10,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      code: "AFF-100",
      clicks: 3,
      conversions: 1,
      product: { id: "product-1", name: "Fine Hair" },
    });
    expect(result.data[0].affiliateName).toBe("Jane Doe");
  });

  it("does not count referral order items with empty affiliateCode as conversions", async () => {
    mockPrisma.seller.findUnique.mockResolvedValue({ id: "seller-1" });
    mockPrisma.product.findMany.mockResolvedValue([{ id: "product-1" }]);
    mockPrisma.affiliateLink.findMany.mockResolvedValue([
      {
        id: "link-1",
        code: "AFF-100",
        clicks: 3,
        conversions: 0,
        affiliateId: "affiliate-1",
        productId: "product-1",
        affiliate: {
          id: "affiliate-1",
          code: "AFF-100",
          user: { id: "user-1", firstName: "Jane", lastName: "Doe" },
        },
        product: { id: "product-1", name: "Fine Hair" },
      },
    ]);
    mockPrisma.affiliateLink.count.mockResolvedValue(1);

    mockPrisma.orderItem.findMany.mockResolvedValue([{ quantity: 1 }]);

    const result = await service.getAffiliateLinksForSeller("user-1", {
      limit: 10,
    });

    expect(result.data[0].conversions).toBe(1);
  });

  it("should calculate pending affiliate payouts from seller product affiliate withdrawals", async () => {
    mockPrisma.seller.findUnique.mockResolvedValue({ id: "seller-1" });
    mockPrisma.orderItem.aggregate.mockResolvedValue({
      _sum: { price: 400 },
      _count: { id: 2 },
    });
    mockPrisma.orderItem.findMany
      .mockResolvedValueOnce([
        { price: 200, quantity: 1, orderId: "order-1" },
        { price: 200, quantity: 1, orderId: "order-2" },
      ])
      .mockResolvedValueOnce([]);
    mockPrisma.product.findMany
      .mockResolvedValueOnce([{ id: "product-1" }])
      .mockResolvedValueOnce([{ id: "product-1" }]);
    mockPrisma.affiliateLink.findMany.mockResolvedValue([
      { affiliateId: "affiliate-1" },
    ]);
    mockPrisma.withdrawalRequest.findMany.mockResolvedValue([
      { amount: 120, status: "PENDING", affiliateId: "affiliate-1" },
    ]);
    mockPrisma.payoutRequest.findMany.mockResolvedValue([]);

    const result = await service.getAnalyticsForSellerByUser("user-1");

    expect(result).toMatchObject({
      totalSales: 400,
      totalOrders: 2,
      pendingAffiliatePayouts: 120,
    });
  });
});
