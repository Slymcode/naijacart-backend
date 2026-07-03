import { IsString, IsOptional, IsEmail } from "class-validator";

export class UpdateSellerDto {
  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  handle?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  socialLinks?: any;

  @IsOptional()
  policies?: any;
}
