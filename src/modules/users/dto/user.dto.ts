import { IsString, IsOptional, IsBoolean } from "class-validator";

export class UpdateUserProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class AddAddressDto {
  @IsString()
  street: string;

  @IsString()
  city: string;

  @IsString()
  state: string;

  @IsString()
  country: string;

  @IsOptional()
  @IsString()
  zipCode?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto {
  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  zipCode?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UserProfileResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  isActive: boolean;
}
