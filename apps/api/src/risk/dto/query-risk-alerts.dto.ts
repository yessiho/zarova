import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { Type } from 'class-transformer';

import {
  RISK_ALERT_STATUSES,
  RISK_SEVERITIES,
} from '../risk.constants.js';

export class QueryRiskAlertsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(RISK_ALERT_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(RISK_SEVERITIES)
  severity?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
