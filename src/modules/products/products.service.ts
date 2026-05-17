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
    const { commissionPercentage, ...productData } = data as any;

    const product = await this.prisma.product.create({
      data: {
        ...productData,
        ownerId: userId,
      },
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

    const skip = (filters?.page || 0) * (filters?.limit || 10);
    const take = filters?.limit || 10;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { productMetrics: true },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data: products, total, page: filters?.page || 0 };
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
      select: { ownerId: true },
    });

    if (!existing) {
      throw new NotFoundException("Product not found");
    }

    if (userRole !== "ADMIN" && existing.ownerId !== userId) {
      throw new ForbiddenException(
        "You do not have permission to update this product.",
      );
    }

    return this.prisma.product.update({
      where: { id },
      data,
      include: { productMetrics: true },
    });
  }

  async deleteProduct(id: string, userId: string, userRole: string) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: {
        ownerId: true,
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

    if (userRole !== "ADMIN" && existing.ownerId !== userId) {
      throw new ForbiddenException(
        "You do not have permission to delete this product.",
      );
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
      where.ownerId = userId;
      where.isActive = true;
    }

    return this.prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { productMetrics: true, owner: true },
    });
  }

  async getFeaturedProducts(limit = 10) {
    return this.prisma.product.findMany({
      where: { isActive: true, isFeatured: true },
      take: limit,
      include: { productMetrics: true },
    });
  }

  async getProductsByCategory(category: string, limit = 12) {
    return this.prisma.product.findMany({
      where: { isActive: true, category },
      take: limit,
      include: { productMetrics: true },
    });
  }
}
