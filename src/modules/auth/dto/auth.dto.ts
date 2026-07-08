import { IsEmail, MinLength, IsOptional, IsString } from "class-validator";

export class SignUpDto {
  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class SignInDto {
  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;
}

export class AuthResponseDto {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
    seller?: {
      id: string;
      handle: string;
      businessName: string;
      status?: string;
    };
  };
  accessToken: string;
}
