import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsBoolean,
  ArrayMinSize,
} from "class-validator";

export class CreateProductDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsString()
  description: string;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsNumber()
  comparePrice?: number;

  @IsOptional()
  @IsNumber()
  commissionPercentage?: number;

  @IsOptional()
  @IsNumber()
  cost?: number;

  @IsNumber()
  stock: number;

  @IsString()
  category: string;

  @IsArray()
  @ArrayMinSize(1)
  images: string[];

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
  comparePrice?: number;

  @IsOptional()
  @IsNumber()
  commissionPercentage?: number;

  @IsOptional()
  @IsNumber()
  cost?: number;

  @IsOptional()
  @IsNumber()
  stock?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  images?: string[];

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
