import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

import { Type } from 'class-transformer';

export class CreateAdminPaymentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceWalletId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  destinationWalletId!: number;

  @IsString()
  @IsIn(['NGN', 'USD', 'EUR', 'GBP'])
  currency!: string;

  @IsString()
  @Matches(/^[1-9]\d*$/, {
    message: 'Amount must be a positive integer in minor units',
  })
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
