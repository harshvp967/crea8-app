import {
  IsDefined,
  IsEmail,
  IsIn,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const AUTH_PROVIDER_NAMES = [
  'LOCAL',
  'GITHUB',
  'GOOGLE',
  'APPLE',
  'FARCASTER',
  'WALLET',
  'GENERIC',
] as const;

export type AuthProviderName = (typeof AUTH_PROVIDER_NAMES)[number];

export class LoginUserDto {
  @IsString()
  @IsDefined()
  @ValidateIf((o) => !o.providerToken)
  @MinLength(3)
  password: string;

  @IsString()
  @IsDefined()
  @IsIn(AUTH_PROVIDER_NAMES)
  provider: AuthProviderName;

  @IsString()
  @IsDefined()
  @ValidateIf((o) => !o.password)
  providerToken: string;

  @IsEmail()
  @IsDefined()
  email: string;

  datafast_visitor_id: string;
}
