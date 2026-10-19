import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class IdeaPostsDto {
  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  idea: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  customer?: string;
}
