import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReviewDto, UpdateReviewDto } from "./dto/review.dto";

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async createReview(userId: string, createReviewDto: CreateReviewDto) {
    const { productId, rating, comment } = createReviewDto;

    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    // Check if user has purchased this product and completed payment
    const order = await this.prisma.order.findFirst({
      where: {
        userId,
        items: {
          some: { productId },
        },
        paymentStatus: "COMPLETED",
      },
    });

    if (!order) {
      throw new ForbiddenException(
        "Only customers who purchased this product with completed payment can leave a review.",
      );
    }

    // Prevent duplicate review for same product by same user
    const existingReview = await this.prisma.review.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    if (existingReview) {
      throw new BadRequestException("You have already reviewed this product.");
    }

    // Create review
    const review = await this.prisma.review.create({
      data: {
        userId,
        productId,
        rating,
        title: "",
        comment,
        isVerified: true,
      },
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    // Update product metrics
    await this.updateProductMetrics(productId);

    if (product.sellerId) {
      await this.updateSellerRating(product.sellerId);
    }

    return review;
  }

  async getProductReviews(productId: string, skip = 0, take = 10) {
    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { productId },
        skip,
        take,
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.review.count({ where: { productId } }),
    ]);

    return { reviews, total };
  }

  async canReviewProduct(userId: string, productId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        userId,
        paymentStatus: "COMPLETED",
        items: {
          some: { productId },
        },
      },
    });

    return !!order;
  }

  async getUserReviews(userId: string) {
    return this.prisma.review.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateReview(
    reviewId: string,
    userId: string,
    updateReviewDto: UpdateReviewDto,
  ) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException("Review not found");
    }

    if (review.userId !== userId) {
      throw new ForbiddenException("Cannot update review from another user");
    }

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        ...updateReviewDto,
      },
    });

    // Update product metrics
    await this.updateProductMetrics(review.productId);

    const product = await this.prisma.product.findUnique({
      where: { id: review.productId },
      select: { sellerId: true },
    });

    if (product?.sellerId) {
      await this.updateSellerRating(product.sellerId);
    }

    return updated;
  }

  async deleteReview(reviewId: string, userId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException("Review not found");
    }

    if (review.userId !== userId) {
      throw new ForbiddenException("Cannot delete review from another user");
    }

    await this.prisma.review.delete({
      where: { id: reviewId },
    });

    // Update product metrics
    await this.updateProductMetrics(review.productId);

    const product = await this.prisma.product.findUnique({
      where: { id: review.productId },
      select: { sellerId: true },
    });

    if (product?.sellerId) {
      await this.updateSellerRating(product.sellerId);
    }

    return { message: "Review deleted successfully" };
  }

  private async updateProductMetrics(productId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { productId },
    });

    const reviewCount = reviews.length;
    const averageRating =
      reviewCount > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
        : 0;

    await this.prisma.productMetric.upsert({
      where: { productId },
      create: {
        productId,
        averageRating,
        reviewCount,
      },
      update: {
        averageRating,
        reviewCount,
      },
    });
  }

  private async updateSellerRating(sellerId: string) {
    const sellerReviews = await this.prisma.review.findMany({
      where: {
        product: {
          sellerId,
        },
      },
      select: { rating: true },
    });

    const reviewCount = sellerReviews.length;
    const averageRating =
      reviewCount > 0
        ? sellerReviews.reduce((sum, review) => sum + review.rating, 0) /
          reviewCount
        : 0;

    await this.prisma.seller.update({
      where: { id: sellerId },
      data: { rating: averageRating },
    });
  }
}
