import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AddToCartDto, UpdateCartItemDto } from "./dto/cart.dto";

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  async getCart(userId: string) {
    const items = await this.prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            seller: {
              select: {
                id: true,
                handle: true,
                businessName: true,
                logo: true,
              },
            },
          },
        },
      },
    });

    const grouped: Record<string, any> = {};
    let subtotal = 0;

    for (const it of items) {
      const sellerId = it.product?.seller?.id || "__marketplace";
      if (!grouped[sellerId]) {
        grouped[sellerId] = {
          seller: it.product?.seller
            ? {
                id: it.product.seller.id,
                handle: it.product.seller.handle,
                businessName: it.product.seller.businessName,
                logo: it.product.seller.logo,
              }
            : null,
          items: [],
          subtotal: 0,
        };
      }

      const lineTotal = it.price * it.quantity;
      grouped[sellerId].items.push({ ...it });
      grouped[sellerId].subtotal += lineTotal;
      subtotal += lineTotal;
    }

    // Convert grouped map to array for deterministic ordering
    const sellers = Object.keys(grouped).map((k) => ({
      sellerId: k,
      ...grouped[k],
    }));

    return { sellers, subtotal };
  }

  async addToCart(userId: string, addToCartDto: AddToCartDto) {
    const { productId, quantity, affiliateCode } = addToCartDto as any;
    const normalizedAffiliateCode = affiliateCode?.trim() || "";

    // Check if product exists and get its price
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    if (product.stock < quantity) {
      throw new NotFoundException("Insufficient stock");
    }

    // Check if item already in cart for the same affiliate code
    const code = normalizedAffiliateCode;
    const existingItem = await this.prisma.cartItem.findUnique({
      where: {
        userId_productId_affiliateCode: {
          userId,
          productId,
          affiliateCode: code,
        },
      },
    });

    if (existingItem) {
      const newQty = existingItem.quantity + quantity;
      if (product.stock < newQty)
        throw new NotFoundException("Insufficient stock");
      return this.updateCartItem(existingItem.id, { quantity: newQty });
    }

    // Add new item (preserve affiliate code so multiple entries can exist for same product)
    return this.prisma.cartItem.create({
      data: {
        userId,
        productId,
        affiliateCode: code,
        quantity,
        price: product.price,
      },
      include: { product: true },
    });
  }

  async updateCartItem(
    cartItemId: string,
    updateCartItemDto: UpdateCartItemDto,
  ) {
    const { quantity } = updateCartItemDto;

    if (quantity === 0) {
      return this.removeFromCart(cartItemId);
    }

    // Ensure stock availability
    const item = await this.prisma.cartItem.findUnique({
      where: { id: cartItemId },
      include: { product: true },
    });
    if (!item) throw new NotFoundException("Cart item not found");
    if (item.product.stock < quantity)
      throw new NotFoundException("Insufficient stock");

    return this.prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity },
      include: { product: true },
    });
  }

  async removeFromCart(cartItemId: string) {
    return this.prisma.cartItem.delete({
      where: { id: cartItemId },
    });
  }

  async clearCart(userId: string) {
    return this.prisma.cartItem.deleteMany({
      where: { userId },
    });
  }
}
