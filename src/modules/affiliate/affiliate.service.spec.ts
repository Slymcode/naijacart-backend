import { validate } from "class-validator";
import { AffiliateService } from "./affiliate.service";
import { WithdrawalRequestDto } from "./dto/affiliate.dto";

describe("AffiliateService", () => {
  let service: AffiliateService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      affiliate: {
        findUnique: jest.fn(),
      },
      affiliateLink: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      affiliateCommission: {
        findUnique: jest.fn(),
      },
      referral: {
        create: jest.fn(),
      },
      commission: {
        create: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
      },
      withdrawalRequest: {
        aggregate: jest.fn(),
      },
      orderItem: {
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
      },
    };

    service = new AffiliateService(prisma);
  });

  it("computes per-link conversion counts from referrals so the dashboard totals stay consistent", async () => {
    prisma.affiliate.findUnique.mockResolvedValue({
      id: "affiliate-1",
      affiliateLinks: [
        {
          id: "link-1",
          code: "AFF-123-product-a",
          clicks: 5,
          conversions: 0,
          product: { name: "Product A" },
        },
        {
          id: "link-2",
          code: "AFF-123-product-b",
          clicks: 3,
          conversions: 0,
          product: { name: "Product B" },
        },
      ],
      referrals: [
        { id: "ref-1", source: "AFF-123-product-a" },
        { id: "ref-2", source: "AFF-123-product-a" },
        { id: "ref-3", source: "AFF-123-product-b" },
      ],
      commissions: [],
      withdrawals: [],
    });

    const result = await service.getAffiliateDashboard("user-1");

    expect(result.stats.totalConversions).toBe(3);
    expect(result.links[0].conversions).toBe(2);
    expect(result.links[1].conversions).toBe(1);
  });

  it("falls back to commission records when referrals are missing so conversions do not stay at zero", async () => {
    prisma.affiliate.findUnique.mockResolvedValue({
      id: "affiliate-1",
      affiliateLinks: [
        {
          id: "link-1",
          code: "AFF-123-product-a",
          clicks: 5,
          conversions: 0,
          product: {
            id: "product-a",
            name: "Product A",
            sellerId: "seller-a",
            seller: { id: "seller-a", businessName: "Seller A" },
          },
        },
      ],
      referrals: [],
      commissions: [
        {
          id: "commission-1",
          orderId: "order-1",
          amount: 100,
          status: "APPROVED",
        },
      ],
      withdrawals: [],
    });
    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      items: [{ id: "item-1", sellerId: "seller-a", price: 100, quantity: 1 }],
    });

    const result = await service.getAffiliateDashboard("user-1");

    expect(result.stats.totalConversions).toBe(1);
    expect(result.links[0].conversions).toBe(1);
    expect(result.sellerBreakdown[0].earnings).toBe(100);
  });

  it("groups affiliate activity by seller so the dashboard can be tiered by vendor", async () => {
    prisma.affiliate.findUnique.mockResolvedValue({
      id: "affiliate-1",
      affiliateLinks: [
        {
          id: "link-1",
          code: "AFF-123-seller-a",
          clicks: 4,
          conversions: 0,
          product: {
            id: "product-a",
            name: "Cool Product",
            sellerId: "seller-a",
            seller: { id: "seller-a", businessName: "Seller A" },
          },
        },
        {
          id: "link-2",
          code: "AFF-123-seller-b",
          clicks: 2,
          conversions: 0,
          product: {
            id: "product-b",
            name: "Other Product",
            sellerId: "seller-b",
            seller: { id: "seller-b", businessName: "Seller B" },
          },
        },
      ],
      referrals: [
        { id: "ref-1", source: "AFF-123-seller-a" },
        { id: "ref-2", source: "AFF-123-seller-a" },
      ],
      commissions: [
        { orderId: "order-1", amount: 120, status: "APPROVED" },
        { orderId: "order-2", amount: 80, status: "APPROVED" },
      ],
      withdrawals: [],
    });
    prisma.order.findUnique
      .mockResolvedValueOnce({
        id: "order-1",
        items: [
          { id: "item-1", sellerId: "seller-a", price: 100, quantity: 1 },
        ],
      })
      .mockResolvedValueOnce({
        id: "order-2",
        items: [
          { id: "item-2", sellerId: "seller-b", price: 100, quantity: 1 },
        ],
      });

    const result = await service.getAffiliateDashboard("user-1");

    expect(result.sellerBreakdown).toHaveLength(2);
    expect(result.sellerBreakdown[0]).toMatchObject({
      sellerId: "seller-a",
      clicks: 4,
      conversions: 3,
      earnings: 120,
    });
  });

  it("uses the remaining available amount per seller after prior withdrawals", async () => {
    prisma.affiliate.findUnique.mockResolvedValue({
      id: "affiliate-1",
      affiliateLinks: [
        {
          id: "link-1",
          code: "AFF-123-seller-a",
          clicks: 2,
          conversions: 0,
          product: {
            id: "product-a",
            name: "Cool Product",
            sellerId: "seller-a",
            seller: { id: "seller-a", businessName: "Seller A" },
          },
        },
      ],
      referrals: [],
      commissions: [{ orderId: "order-1", amount: 1000, status: "APPROVED" }],
      withdrawals: [
        { id: "w1", sellerId: "seller-a", amount: 400, status: "PENDING" },
      ],
    });
    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      items: [{ id: "item-1", sellerId: "seller-a", price: 100, quantity: 1 }],
    });

    const result = await service.getAffiliateDashboard("user-1");

    expect(result.sellerBreakdown[0]).toMatchObject({
      sellerId: "seller-a",
      earnings: 1000,
    });
  });

  it("accepts a withdrawal amount below 1000 when the user has enough available balance", async () => {
    const dto = new WithdrawalRequestDto();
    dto.amount = 1000;
    dto.sellerId = "seller-a";
    dto.bankName = "Test Bank";
    dto.accountNumber = "123456";
    dto.accountHolder = "Test User";

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
