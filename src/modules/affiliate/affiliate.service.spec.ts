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

  it("counts multiple link conversions for the same affiliate when one order contains two different affiliate codes", async () => {
    prisma.affiliate.findUnique.mockResolvedValue({
      id: "affiliate-1",
      affiliateLinks: [
        {
          id: "link-1",
          code: "AFF-123-shoe-place",
          clicks: 5,
          conversions: 0,
          product: {
            id: "product-shoe",
            name: "Shoe Place",
            sellerId: "seller-a",
            seller: { id: "seller-a", businessName: "Seller A" },
          },
        },
        {
          id: "link-2",
          code: "AFF-123-qwerrty",
          clicks: 3,
          conversions: 0,
          product: {
            id: "product-qwerrty",
            name: "Qwerrty",
            sellerId: "seller-b",
            seller: { id: "seller-b", businessName: "Seller B" },
          },
        },
      ],
      referrals: [
        {
          id: "ref-1",
          orderId: "order-1",
          source: "AFF-123-shoe-place",
        },
      ],
      commissions: [
        {
          id: "commission-1",
          orderId: "order-1",
          amount: 2750,
          status: "APPROVED",
        },
      ],
      withdrawals: [],
    });

    prisma.affiliateCommission.findUnique
      .mockResolvedValueOnce({ percentage: 50 })
      .mockResolvedValueOnce({ percentage: 50 });

    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      items: [
        {
          id: "item-1",
          sellerId: "seller-a",
          productId: "product-shoe",
          price: 2500,
          quantity: 1,
          affiliateCode: "AFF-123-shoe-place",
        },
        {
          id: "item-2",
          sellerId: "seller-b",
          productId: "product-qwerrty",
          price: 3000,
          quantity: 1,
          affiliateCode: "AFF-123-qwerrty",
        },
      ],
    });

    const result = await service.getAffiliateDashboard("user-1");

    expect(result.stats.totalConversions).toBe(2);
    expect(result.stats.totalEarnings).toBe(2750);
    expect(
      result.links.find((link: any) => link.id === "link-1").conversions,
    ).toBe(1);
    expect(
      result.links.find((link: any) => link.id === "link-2").conversions,
    ).toBe(1);
    expect(result.sellerBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sellerId: "seller-a", earnings: 1250 }),
        expect.objectContaining({ sellerId: "seller-b", earnings: 1500 }),
      ]),
    );
  });

  it("counts conversions based on item quantity so earnings remain synced", async () => {
    prisma.affiliate.findUnique.mockResolvedValue({
      id: "affiliate-1",
      affiliateLinks: [
        {
          id: "link-1",
          code: "AFF-123-shoe-place",
          clicks: 5,
          conversions: 0,
          product: {
            id: "product-shoe",
            name: "Shoe Place",
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
          amount: 3750,
          status: "APPROVED",
        },
      ],
      withdrawals: [],
    });

    prisma.affiliateCommission.findUnique.mockResolvedValue({ percentage: 50 });

    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      items: [
        {
          id: "item-1",
          sellerId: "seller-a",
          productId: "product-shoe",
          price: 2500,
          quantity: 3,
          affiliateCode: "AFF-123-shoe-place",
        },
      ],
    });

    const result = await service.getAffiliateDashboard("user-1");

    expect(result.stats.totalConversions).toBe(3);
    expect(result.stats.totalEarnings).toBe(3750);
    expect(result.links[0].conversions).toBe(3);
    expect(result.sellerBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sellerId: "seller-a", earnings: 3750 }),
      ]),
    );
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

    // With seller-based fallback removed, commission-only orders no longer
    // count as link conversions. Expect zero conversions and zero earnings.
    expect(result.stats.totalConversions).toBe(0);
    expect(result.links[0].conversions).toBe(0);
    expect(result.sellerBreakdown[0].earnings).toBe(0);
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
      conversions: 2,
      earnings: 0,
    });
  });

  it("does not assign affiliate earnings to unrelated sellers when only affiliate-linked order items should count", async () => {
    prisma.affiliate.findUnique.mockResolvedValue({
      id: "affiliate-1",
      affiliateLinks: [
        {
          id: "link-1",
          code: "AFF-123-product-a",
          clicks: 2,
          conversions: 0,
          product: {
            id: "product-a",
            name: "Product A",
            sellerId: "seller-a",
            seller: { id: "seller-a", businessName: "Seller A" },
          },
        },
      ],
      referrals: [
        { id: "ref-1", orderId: "order-1", source: "AFF-123-product-a" },
      ],
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

    prisma.affiliateCommission.findUnique.mockResolvedValue({
      percentage: 100,
    });
    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      items: [
        {
          id: "item-1",
          sellerId: "seller-a",
          productId: "product-a",
          price: 100,
          quantity: 1,
          affiliateCode: "AFF-123-product-a",
        },
        {
          id: "item-2",
          sellerId: "seller-c",
          productId: "product-c",
          price: 50,
          quantity: 1,
        },
      ],
    });

    const result = await service.getAffiliateDashboard("user-1");

    expect(result.sellerBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sellerId: "seller-a", earnings: 100 }),
      ]),
    );
    expect(result.sellerBreakdown).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sellerId: "seller-c" }),
      ]),
    );
  });

  it("does not attribute direct-added product to affiliate when only another item used an affiliate link", async () => {
    prisma.affiliate.findUnique.mockResolvedValue({
      id: "affiliate-1",
      affiliateLinks: [
        {
          id: "link-1",
          code: "AFF-123-shoe-place",
          clicks: 2,
          conversions: 0,
          product: {
            id: "product-shoe",
            name: "Shoe Place",
            sellerId: "seller-b",
            seller: { id: "seller-b", businessName: "Seller B" },
          },
        },
      ],
      referrals: [],
      commissions: [
        {
          id: "commission-1",
          orderId: "order-1",
          amount: 200,
          status: "APPROVED",
        },
      ],
      withdrawals: [],
    });

    // The order contains two items: one added via affiliate link, one added directly
    prisma.affiliateCommission.findUnique.mockResolvedValue({
      percentage: 100,
    });
    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      items: [
        {
          id: "item-1",
          sellerId: "seller-b",
          productId: "product-shoe",
          price: 100,
          quantity: 1,
          affiliateCode: "AFF-123-shoe-place",
        },
        {
          id: "item-2",
          sellerId: "seller-a",
          productId: "product-qwerrty",
          price: 100,
          quantity: 1,
          // added directly from shop, no affiliateCode
        },
      ],
    });

    const result = await service.getAffiliateDashboard("user-1");

    // Only the seller that had the affiliate-linked item should receive earnings
    expect(result.sellerBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sellerId: "seller-b", earnings: 200 }),
      ]),
    );

    // Seller-a (direct-added product) must not be credited to the affiliate
    expect(result.sellerBreakdown).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sellerId: "seller-a" }),
      ]),
    );
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

    // With no seller fallback, earnings are not attributed from commission-only
    // orders; earnings remain zero for the breakdown entries.
    expect(result.sellerBreakdown[0]).toMatchObject({
      sellerId: "seller-a",
      earnings: 0,
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
