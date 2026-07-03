import { ProductsService } from "./products.service";

describe("ProductsService", () => {
  let service: ProductsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      product: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      seller: {
        findUnique: jest.fn(),
      },
      affiliateCommission: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };

    service = new ProductsService(prisma);
  });

  it("orders featured products by newest first", async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await service.getFeaturedProducts(5);

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("returns distinct active categories", async () => {
    prisma.product.findMany.mockResolvedValue([
      { category: "Accessories" },
      { category: "Wristwatches" },
      { category: "Accessories" },
    ]);

    const result = await service.getCategories();

    expect(result).toEqual({ data: ["Accessories", "Wristwatches"] });
  });
});
