import { IsString, IsOptional, IsEmail, IsNotEmpty } from "class-validator";

export class CreateSellerDto {
  @IsString()
  businessName: string;

  @IsOptional()
  @IsString()
  handle?: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

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
