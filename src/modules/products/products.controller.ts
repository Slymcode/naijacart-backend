import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ProductsService } from "./products.service";
import { CreateProductDto, UpdateProductDto } from "./dto/product.dto";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { Roles, RolesGuard } from "../auth/roles.guard";
import { ApiTags, ApiOperation } from "@nestjs/swagger";

@ApiTags("Products")
@Controller("products")
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: "Get all products with filters" })
  async getProducts(@Query() filters: any) {
    return this.productsService.getProducts(filters);
  }

  @Get("featured")
  @ApiOperation({ summary: "Get featured products" })
  async getFeaturedProducts(@Query("limit") limit = 10) {
    return this.productsService.getFeaturedProducts(limit);
  }

  @Get("category/:category")
  @ApiOperation({ summary: "Get products by category" })
  async getByCategory(@Param("category") category: string) {
    return this.productsService.getProductsByCategory(category);
  }

  @Get("owner")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Get products owned by current user or all products for admin",
  })
  async getOwnerProducts(@Request() req) {
    return this.productsService.getProductsForUser(req.user.id, req.user.role);
  }

  @Get(":slug")
  @ApiOperation({ summary: "Get product by slug" })
  async getBySlug(@Param("slug") slug: string) {
    return this.productsService.getProductBySlug(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(["ADMIN"])
  @ApiOperation({ summary: "Create product (Admin only)" })
  async createProduct(
    @Request() req,
    @Body() createProductDto: CreateProductDto,
  ) {
    return this.productsService.createProduct(req.user.id, createProductDto);
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Update product (Admin or owner)" })
  async updateProduct(
    @Request() req,
    @Param("id") id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.updateProduct(
      id,
      req.user.id,
      req.user.role,
      updateProductDto,
    );
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Delete product (Admin or owner)" })
  async deleteProduct(@Request() req, @Param("id") id: string) {
    return this.productsService.deleteProduct(id, req.user.id, req.user.role);
  }
}
