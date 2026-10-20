import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum BillType {
  AIRTIME     = 'AIRTIME',
  DATA        = 'DATA',
  ELECTRICITY = 'ELECTRICITY',
  CABLE_TV    = 'CABLE_TV',
  INTERNET    = 'INTERNET',
}

export class PayBillDto {
  @ApiProperty({ enum: BillType, example: BillType.AIRTIME })
  @IsEnum(BillType)
  billType: BillType;

  @ApiProperty({ example: 'MTN' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  provider: string;

  @ApiProperty({
    example: '08012345678',
    description: 'Phone number, meter number, or smartcard number',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  recipient: string;

  @ApiProperty({ example: 500, description: 'Amount in whole units (e.g. NGN)' })
  @IsInt()
  @IsPositive()
  amount: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  walletId: number;

  @ApiPropertyOptional({ example: 'Top-up for work SIM' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
