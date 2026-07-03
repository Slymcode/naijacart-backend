import { IsString, IsOptional, IsEmail } from "class-validator";

export class CreateSellerDto {
  @IsString()
  businessName: string;

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
  @IsString()
  logo?: string;

  @IsOptional()
  socialLinks?: any;

  @IsOptional()
  policies?: any;
}
