import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { CreateOrderDto, UpdateOrderStatusDto } from "./dto/order.dto";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { Roles, RolesGuard } from "../auth/roles.guard";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";

@ApiTags("Orders")
@ApiBearerAuth("access-token")
@Controller("orders")
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Create a new order" })
  async createOrder(@Request() req, @Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.createOrder(req.user.id, createOrderDto);
  }

  @Get("admin/all")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(["ADMIN"])
  @ApiOperation({ summary: "Get all orders (Admin only)" })
  async getAllOrders(@Query("skip") skip = 0, @Query("take") take = 10) {
    return this.ordersService.getAllOrders(skip, take);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get user orders" })
  async getUserOrders(@Request() req) {
    return this.ordersService.getUserOrders(req.user.id);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get order details" })
  async getOrder(@Param("id") id: string, @Request() req) {
    // pass seller context if available on JWT
    const sellerId =
      req.user && req.user.sellerId ? req.user.sellerId : undefined;
    return this.ordersService.getOrder(id, req.user.id, sellerId);
  }

  @Put(":id/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(["ADMIN"])
  @ApiOperation({ summary: "Update order status (Admin only)" })
  async updateOrderStatus(
    @Param("id") id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateOrderStatus(id, updateOrderStatusDto);
  }
}
