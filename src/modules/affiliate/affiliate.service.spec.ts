import { AffiliateService } from "./affiliate.service";

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
      withdrawalRequest: {
        aggregate: jest.fn(),
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
});
