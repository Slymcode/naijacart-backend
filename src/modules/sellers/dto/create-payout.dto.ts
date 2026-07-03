import { IsNumber, IsOptional, IsString } from "class-validator";

export class CreatePayoutDto {
  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  note?: string;
}
