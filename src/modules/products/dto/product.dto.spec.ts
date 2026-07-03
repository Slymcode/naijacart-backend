import { validate } from "class-validator";
import { CreateProductDto } from "./product.dto";

describe("CreateProductDto", () => {
  it("allows a product to be created without an explicit cost", async () => {
    const dto = new CreateProductDto();

    Object.assign(dto, {
      name: "Test product",
      slug: "test-product",
      description: "A test product",
      price: 1999,
      stock: 10,
      category: "electronics",
      images: ["https://example.com/image.jpg"],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it("rejects products without any images", async () => {
    const dto = new CreateProductDto();

    Object.assign(dto, {
      name: "Test product",
      slug: "test-product",
      description: "A test product",
      price: 1999,
      stock: 10,
      category: "electronics",
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === "images")).toBe(true);
  });
});
