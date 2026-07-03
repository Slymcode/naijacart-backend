import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProductDto, UpdateProductDto } from "./dto/product.dto";

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async createProduct(userId: string, data: CreateProductDto) {
    const { commissionPercentage, cost, ...productData } = data as any;

    // Attach seller info if user is a seller
    const seller = await this.prisma.seller.findUnique({ where: { userId } });

    const createData: any = {
      ...productData,
      ownerId: userId,
      cost: cost ?? productData.price ?? 0,
    };

    if (seller) {
      createData.sellerId = seller.id;
      createData.sellerHandle = seller.handle;
    }

    const product = await this.prisma.product.create({
      data: createData,
      include: { productMetrics: true },
    });

    if (commissionPercentage !== undefined && commissionPercentage !== null) {
      const roundedPercentage = Math.round(commissionPercentage * 100) / 100;

      await this.prisma.affiliateCommission.upsert({
        where: { productId: product.id },
        create: {
          productId: product.id,
          percentage: roundedPercentage,
        },
        update: {
          percentage: roundedPercentage,
        },
      });
    }

    return product;
  }

  async getProducts(filters?: any) {
    const where: any = { isActive: true };

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const page = Number(filters?.page);
    const limit = Number(filters?.limit);
    const skip =
      (Number.isInteger(page) ? page : 0) *
      (Number.isInteger(limit) ? limit : 10);
    const take = Number.isInteger(limit) ? limit : 10;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          productMetrics: true,
          seller: {
            select: { id: true, handle: true, businessName: true, logo: true },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data: products, total, page: Number.isInteger(page) ? page : 0 };
  }

  async getCategories() {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      select: { category: true },
      orderBy: { category: "asc" },
    });

    const categories = [
      ...new Set(
        products.map((product: any) => product.category).filter(Boolean),
      ),
    ];

    return { data: categories };
  }

  async getProductBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        reviews: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        productMetrics: true,
        affiliateLinks: true,
        seller: {
          select: { id: true, handle: true, businessName: true, logo: true },
        },
      },
    });

    if (!product) {
      return null;
    }

    const affiliateCommission =
      await this.prisma.affiliateCommission.findUnique({
        where: { productId: product.id },
      });

    return {
      ...product,
      commissionPercentage: affiliateCommission?.percentage,
    };
  }

  async getProductById(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: { reviews: true, productMetrics: true },
    });
  }

  async updateProduct(
    id: string,
    userId: string,
    userRole: string,
    data: UpdateProductDto,
  ) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: { ownerId: true, sellerId: true },
    });

    if (!existing) {
      throw new NotFoundException("Product not found");
    }

    if (userRole !== "ADMIN") {
      // allow owner or seller to update
      const seller = await this.prisma.seller.findUnique({ where: { userId } });
      const isSellerOwner = seller
        ? (existing as any).sellerId === seller.id
        : false;
      if (existing.ownerId !== userId && !isSellerOwner) {
        throw new ForbiddenException(
          "You do not have permission to update this product.",
        );
      }
    }

    const { commissionPercentage, ...productData } = data as any;

    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: productData,
      include: { productMetrics: true },
    });

    if (commissionPercentage !== undefined && commissionPercentage !== null) {
      const roundedPercentage = Math.round(commissionPercentage * 100) / 100;
      await this.prisma.affiliateCommission.upsert({
        where: { productId: updatedProduct.id },
        create: {
          productId: updatedProduct.id,
          percentage: roundedPercentage,
        },
        update: {
          percentage: roundedPercentage,
        },
      });
    }

    return updatedProduct;
  }

  async deleteProduct(id: string, userId: string, userRole: string) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: {
        ownerId: true,
        sellerId: true,
        cartItems: {
          select: { id: true },
          take: 1,
        },
        orderItems: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException("Product not found");
    }

    if (userRole !== "ADMIN") {
      const seller = await this.prisma.seller.findUnique({ where: { userId } });
      const isSellerOwner = seller
        ? (existing as any).sellerId === seller.id
        : false;
      if (existing.ownerId !== userId && !isSellerOwner) {
        throw new ForbiddenException(
          "You do not have permission to delete this product.",
        );
      }
    }

    if (existing.cartItems.length > 0 || existing.orderItems.length > 0) {
      throw new BadRequestException(
        "Product cannot be deleted because it has already been ordered or added to a cart.",
      );
    }

    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getProductsForUser(userId: string, userRole: string) {
    const where: any = {};

    if (userRole !== "ADMIN") {
      const seller = await this.prisma.seller.findUnique({ where: { userId } });
      if (seller) {
        where.OR = [{ sellerId: seller.id }, { ownerId: userId }];
      } else {
        where.ownerId = userId;
      }
      where.isActive = true;
    }

    const products = await this.prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { productMetrics: true, owner: true },
    });

    if (products.length === 0) {
      return products;
    }

    const commissions = await this.prisma.affiliateCommission.findMany({
      where: {
        productId: { in: products.map((product) => product.id) },
      },
    });

    return products.map((product) => ({
      ...product,
      commissionPercentage: commissions.find(
        (commission) => commission.productId === product.id,
      )?.percentage,
    }));
  }

  async getFeaturedProducts(limit = 10) {
    return this.prisma.product.findMany({
      where: { isActive: true, isFeatured: true },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { productMetrics: true },
    });
  }

  async getProductsByCategory(category: string, limit = 12) {
    return this.prisma.product.findMany({
      where: { isActive: true, category },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { productMetrics: true },
    });
  }
}
