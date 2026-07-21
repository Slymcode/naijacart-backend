import { IsString, IsNumber, Min, IsOptional } from "class-validator";

export class AddToCartDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsString()
  @IsOptional()
  affiliateCode?: string;
}

export class UpdateCartItemDto {
  @IsNumber()
  @Min(0)
  quantity: number;
}
