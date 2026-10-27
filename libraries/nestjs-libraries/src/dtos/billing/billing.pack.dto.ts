import { IsIn } from 'class-validator';

export class BillingPackDto {
  @IsIn(['PACK_150', 'PACK_500'])
  pack: 'PACK_150' | 'PACK_500';
}
