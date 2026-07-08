import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Param,
  Query,
  Put,
} from "@nestjs/common";
import { SellersService } from "./sellers.service";
import { CreateSellerDto } from "./dto/create-seller.dto";
import { UpdateSellerDto } from "./dto/update-seller.dto";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { Roles, RolesGuard } from "../auth/roles.guard";
import { ApiTags, ApiOperation } from "@nestjs/swagger";

@ApiTags("Sellers")
@Controller("sellers")
export class SellersController {
  constructor(private sellersService: SellersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Register as a seller" })
  async registerSeller(
    @Request() req,
    @Body() createSellerDto: CreateSellerDto,
  ) {
    return this.sellersService.createSeller(req.user.id, createSellerDto);
  }

  @Get()
  @ApiOperation({ summary: "List sellers" })
  async list(@Query() query: any) {
    return this.sellersService.listSellers(query);
  }

  @Get(":handle")
  @ApiOperation({ summary: "Get seller by handle" })
  async getByHandle(@Param("handle") handle: string) {
    return this.sellersService.getSellerByHandle(handle);
  }

  // Admin endpoints
  @Get("/admin/list")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(["ADMIN"])
  @ApiOperation({ summary: "Admin: list sellers" })
  async adminList(@Query() query: any) {
    return this.sellersService.adminListSellers(query);
  }

  @Put("/admin/:id/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(["ADMIN"])
  @ApiOperation({ summary: "Admin: update seller status" })
  async adminUpdateStatus(@Param("id") id: string, @Body() body: any) {
    return this.sellersService.adminUpdateSellerStatus(id, body.status);
  }

  @Put("/admin/:id/verify")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(["ADMIN"])
  @ApiOperation({ summary: "Admin: set seller verified" })
  async adminVerify(@Param("id") id: string, @Body() body: any) {
    return this.sellersService.adminSetSellerVerified(id, !!body.isVerified);
  }

  // Payout endpoints
  @Post("/me/payouts")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Request payout (seller)" })
  async requestPayout(@Request() req, @Body() body: any) {
    return this.sellersService.createPayoutRequestForSeller(req.user.id, body);
  }

  @Get("/admin/payouts")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(["ADMIN"])
  @ApiOperation({ summary: "Admin: list payout requests" })
  async adminListPayouts(@Query() query: any) {
    return this.sellersService.adminListPayouts(query);
  }

  @Put("/admin/payouts/:id/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(["ADMIN"])
  @ApiOperation({ summary: "Admin: update payout status" })
  async adminUpdatePayoutStatus(
    @Param("id") id: string,
    @Body() body: any,
    @Request() req,
  ) {
    return this.sellersService.adminUpdatePayoutStatus(
      id,
      body.status,
      req.user.id,
    );
  }

  @Get("/me/orders")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get orders for current seller" })
  async getMyOrders(@Request() req, @Query() query: any) {
    return this.sellersService.getOrdersForSellerByUser(req.user.id, query);
  }

  @Get("/me/analytics")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get analytics for current seller" })
  async getMyAnalytics(@Request() req) {
    return this.sellersService.getAnalyticsForSellerByUser(req.user.id);
  }

  @Get("/me/affiliate-links")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get affiliate links promoting your products" })
  async getAffiliateLinks(@Request() req, @Query() query: any) {
    return this.sellersService.getAffiliateLinksForSeller(req.user.id, query);
  }

  @Get("/me/affiliate-payout-requests")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Get affiliate payout requests tied to the seller's products",
  })
  async getAffiliatePayoutRequests(@Request() req) {
    return this.sellersService.getAffiliatePayoutRequestsForSeller(req.user.id);
  }

  @Put("/me/affiliate-withdrawals/:id/status")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      "Seller: update affiliate withdrawal status for withdrawals tied to their products",
  })
  async updateAffiliateWithdrawalStatus(
    @Request() req,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    return this.sellersService.updateAffiliateWithdrawalStatusForSeller(
      req.user.id,
      id,
      body.status,
    );
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Update seller profile" })
  async updateSeller(
    @Request() req,
    @Param("id") id: string,
    @Body() body: UpdateSellerDto,
  ) {
    return this.sellersService.updateSeller(
      id,
      req.user.id,
      req.user.role,
      body,
    );
  }
}
