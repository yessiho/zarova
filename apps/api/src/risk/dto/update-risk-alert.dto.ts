import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  RISK_ALERT_STATUSES,
  RISK_SEVERITIES,
} from '../risk.constants.js';

export class UpdateRiskAlertDto {
  @IsOptional()
  @IsIn(RISK_ALERT_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(RISK_SEVERITIES)
  severity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  resolutionNotes?: string;
}
