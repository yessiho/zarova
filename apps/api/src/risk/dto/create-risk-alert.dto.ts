import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import {
  RISK_ALERT_TYPES,
  RISK_SEVERITIES,
} from '../risk.constants.js';

export class CreateRiskAlertDto {
  @IsString()
  @IsIn(RISK_ALERT_TYPES)
  type!: string;

  @IsString()
  @IsIn(RISK_SEVERITIES)
  severity!: string;

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
  @IsInt()
  @Min(1)
  userId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  alertCode?: string;
}
