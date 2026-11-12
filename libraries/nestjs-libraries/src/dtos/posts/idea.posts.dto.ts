import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class IdeaPostsDto {
  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  idea: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  customer?: string;

  // Omitted means short. one_short and one_long match the older generator names.
  @IsOptional()
  @IsString()
  @IsIn(['short', 'long', 'thread_short', 'thread_long', 'one_short', 'one_long'])
  format?: 'short' | 'long' | 'thread_short' | 'thread_long' | 'one_short' | 'one_long';

  // Omitted means personal.
  @IsOptional()
  @IsString()
  @IsIn(['personal', 'company'])
  voice?: 'personal' | 'company';
}
