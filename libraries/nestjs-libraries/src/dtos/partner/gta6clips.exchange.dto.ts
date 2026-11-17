import { IsOptional, IsString, MaxLength } from 'class-validator';

export class Gta6clipsExchangeDto {
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  token?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  video?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string;
}

export class Gta6clipsLinkDto {
  @IsString()
  @MaxLength(80)
  pendingId: string;
}
