import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import {
  UpdateUserProfileDto,
  AddAddressDto,
  UpdateAddressDto,
} from "./dto/user.dto";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";

@ApiTags("Users")
@ApiBearerAuth("access-token")
@Controller("users")
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get("profile")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get user profile" })
  async getProfile(@Request() req) {
    return this.usersService.getUserProfile(req.user.id);
  }

  @Put("profile")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Update user profile" })
  async updateProfile(
    @Request() req,
    @Body() updateUserProfileDto: UpdateUserProfileDto,
  ) {
    return this.usersService.updateUserProfile(
      req.user.id,
      updateUserProfileDto,
    );
  }

  @Get("addresses")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get user addresses" })
  async getAddresses(@Request() req) {
    return this.usersService.getUserAddresses(req.user.id);
  }

  @Post("addresses")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Add new address" })
  async addAddress(@Request() req, @Body() addAddressDto: AddAddressDto) {
    return this.usersService.addAddress(req.user.id, addAddressDto);
  }

  @Put("addresses/:id")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Update user address" })
  async updateAddress(
    @Request() req,
    @Param("id") id: string,
    @Body() updateAddressDto: UpdateAddressDto,
  ) {
    return this.usersService.updateAddress(req.user.id, id, updateAddressDto);
  }

  @Delete("addresses/:id")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Delete user address" })
  async deleteAddress(@Request() req, @Param("id") id: string) {
    return this.usersService.deleteAddress(req.user.id, id);
  }
}
