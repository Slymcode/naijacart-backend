import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Query,
} from "@nestjs/common";
import { AdminService } from "./admin.service";
import { CreateAdminDto, SetCommissionDto } from "./dto/admin.dto";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { Roles, RolesGuard } from "../auth/roles.guard";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";

@ApiTags("Admin")
@ApiBearerAuth("access-token")
@Controller("admin")
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Post("create-admin")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(["ADMIN"])
  @ApiOperation({ summary: "Create a new admin account (Admin only)" })
  async createAdmin(@Body() createAdminDto: CreateAdminDto) {
    return this.adminService.createAdmin(
      createAdminDto.email,
      createAdminDto.password,
      createAdminDto.firstName,
      createAdminDto.lastName,
    );
  }

  @Get("dashboard")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(["ADMIN"])
  @ApiOperation({ summary: "Get dashboard statistics" })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get("orders")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(["ADMIN"])
  @ApiOperation({ summary: "Get order analytics" })
  async getOrderAnalytics(@Query("skip") skip = 0, @Query("take") take = 10) {
    return this.adminService.getOrderAnalytics(skip, take);
  }

  @Get("products")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(["ADMIN"])
  @ApiOperation({ summary: "Get product analytics" })
  async getProductAnalytics() {
    return this.adminService.getProductAnalytics();
  }

  @Get("affiliates")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(["ADMIN"])
  @ApiOperation({ summary: "Get affiliate analytics" })
  async getAffiliateAnalytics() {
    return this.adminService.getAffiliateAnalytics();
  }

  @Get("platform-account")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(["ADMIN"])
  @ApiOperation({ summary: "Get platform account balance" })
  async getPlatformAccount() {
    return this.adminService.getPlatformAccount();
  }

  @Get("withdrawals")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(["ADMIN"])
  @ApiOperation({ summary: "Get affiliate withdrawal requests" })
  async getWithdrawalRequests() {
    return this.adminService.getWithdrawalRequests();
  }

  @Put("withdrawals/:id/approve")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(["ADMIN"])
  @ApiOperation({ summary: "Approve withdrawal request" })
  async approveWithdrawal(@Param("id") id: string) {
    return this.adminService.approveWithdrawal(id);
  }

  @Put("withdrawals/:id/complete")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(["ADMIN"])
  @ApiOperation({ summary: "Complete withdrawal" })
  async completeWithdrawal(@Param("id") id: string) {
    return this.adminService.completeWithdrawal(id);
  }

  @Put("withdrawals/:id/reject")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(["ADMIN"])
  @ApiOperation({ summary: "Reject withdrawal request" })
  async rejectWithdrawal(@Param("id") id: string) {
    return this.adminService.rejectWithdrawal(id);
  }

  @Post("commission/:productId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(["ADMIN"])
  @ApiOperation({ summary: "Set affiliate commission for product" })
  async setCommission(
    @Param("productId") productId: string,
    @Body() setCommissionDto: SetCommissionDto,
  ) {
    return this.adminService.setAffiliateCommission(
      productId,
      setCommissionDto.percentage,
    );
  }

  @Get("commission")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(["ADMIN"])
  @ApiOperation({ summary: "Get all affiliate commissions" })
  async getCommissions() {
    return this.adminService.getAffiliateCommissions();
  }
}
