import { IsString, IsOptional, IsNumber, Min } from "class-validator";

export class RegisterAffiliateDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  bankName: string;

  @IsOptional()
  @IsString()
  accountNumber: string;

  @IsOptional()
  @IsString()
  accountHolder: string;
}

export class GenerateAffiliateLinkDto {
  @IsString()
  productId: string;
}

export class WithdrawalRequestDto {
  @IsNumber()
  @Min(1000)
  amount: number;

  @IsOptional()
  @IsString()
  sellerId?: string;

  @IsOptional()
  @IsString()
  bankName: string;

  @IsOptional()
  @IsString()
  accountNumber: string;

  @IsOptional()
  @IsString()
  accountHolder: string;
}
