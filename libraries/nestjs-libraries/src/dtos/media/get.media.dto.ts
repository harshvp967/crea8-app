import { IsIn, IsOptional } from 'class-validator';

// Query value for GET /media. Omitted and 'all' both mean no type filter.
export const MEDIA_LIST_TYPES = ['all', 'image', 'video'] as const;
export type MediaListType = (typeof MEDIA_LIST_TYPES)[number];

export class GetMediaQueryDto {
  @IsOptional()
  @IsIn(MEDIA_LIST_TYPES)
  type?: MediaListType;
}
