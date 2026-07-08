import {
  IsString,
  IsNumber,
  IsOptional,
  ValidateNested,
  IsArray,
  IsEnum,
} from "class-validator";
import { Type } from "class-transformer";
import { OrderStatus } from "@prisma/client";

export class CreateOrderItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsString()
  affiliateCode?: string;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsString()
  shippingAddress: string;

  @IsString()
  shippingCity: string;

  @IsString()
  shippingState: string;

  @IsString()
  shippingCountry: string;

  @IsOptional()
  @IsString()
  shippingZipCode?: string;

  @IsOptional()
  @IsString()
  affiliateCode?: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
