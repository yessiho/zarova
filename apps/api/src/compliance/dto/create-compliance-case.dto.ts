import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import {
  COMPLIANCE_CASE_TYPES,
  COMPLIANCE_PRIORITIES,
} from '../compliance.constants.js';

export class CreateComplianceCaseDto {
  @IsString()
  @IsIn(COMPLIANCE_CASE_TYPES)
  type!: string;

  @IsString()
  @IsIn(COMPLIANCE_PRIORITIES)
  priority!: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(5000)
  description!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  transactionId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  walletId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  alertCode?: string;
}