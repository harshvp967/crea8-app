import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  IsIn,
  IsDateString,
} from 'class-validator';
import { Transform } from 'class-transformer';

export type PostListStateFilter = 'all' | 'scheduled' | 'draft' | 'published';

export class GetPostsListDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 20;

  @IsOptional()
  @IsString()
  customer?: string;

  @IsOptional()
  @IsIn(['all', 'scheduled', 'draft', 'published'])
  state?: PostListStateFilter = 'all';

  // All tab only. Start of today in the user's timezone, as a UTC instant.
  // Scheduled has no date bound. Published and drafts ignore this field.
  @IsOptional()
  @IsDateString()
  from?: string;
}
