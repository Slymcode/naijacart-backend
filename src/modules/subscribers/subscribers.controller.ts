import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { SubscribersService } from "./subscribers.service";
import { CreateSubscriberDto } from "./dto/subscriber.dto";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { Roles, RolesGuard } from "../auth/roles.guard";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";

@ApiTags("Subscribers")
@Controller("subscribers")
export class SubscribersController {
  constructor(private subscribersService: SubscribersService) {}

  @Post()
  @ApiOperation({ summary: "Subscribe an email address" })
  async subscribe(@Body() createSubscriberDto: CreateSubscriberDto) {
    return this.subscribersService.createSubscriber(createSubscriberDto.email);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(["ADMIN"])
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "List email subscribers" })
  async getSubscribers(@Query("skip") skip = 0, @Query("take") take = 20) {
    return this.subscribersService.getSubscribers(Number(skip), Number(take));
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(["ADMIN"])
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Remove an email subscriber" })
  async removeSubscriber(@Param("id") id: string) {
    return this.subscribersService.removeSubscriber(id);
  }
}
