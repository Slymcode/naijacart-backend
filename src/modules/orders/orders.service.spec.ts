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
    mockPrisma.product.findUnique.mockResolvedValue({ id: "product-1", name: "Test", price: 100, stock: 0 });

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

    expect(mockPrisma.order.create).toHaveBeenCalled();
    expect(mockPrisma.order.create.mock.calls[0][0].data.items.create[0].sellerId).toBe("seller-123");
    expect(order).toEqual({ id: "order-1", items: [{ id: "item-1", sellerId: "seller-123" }] });
  });
});
