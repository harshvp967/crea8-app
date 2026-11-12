import { IsDefined, IsOptional, IsString } from 'class-validator';

export class TokenExchangeDto {
  @IsString()
  @IsDefined()
  grant_type: string;

  // Required for authorization_code. refresh_token grants omit it.
  // The service rejects an authorization_code request that arrives without one.
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  refresh_token?: string;

  // Optional here because client_secret_basic clients send the id and secret
  // in the Authorization header; the controller merges the two sources and
  // the service rejects a request that ends up without a client_id
  @IsString()
  @IsOptional()
  client_id?: string;

  // Optional to allow PKCE-only public clients (dynamic registration);
  // the service still enforces it for confidential clients
  @IsString()
  @IsOptional()
  client_secret?: string;

  @IsString()
  @IsOptional()
  code_verifier?: string;

  @IsString()
  @IsOptional()
  redirect_uri?: string;
}
