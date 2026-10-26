import { IsDefined, IsString, MaxLength } from 'class-validator';

export class CustomerNameDto {
  @IsDefined()
  @IsString()
  @MaxLength(200)
  name: string;
}
