import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';

export class BrandVoiceSamplesDto {
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(2000, { each: true })
  samples: string[];
}

export class BrandVoiceToggleDto {
  @IsBoolean()
  enabled: boolean;
}
