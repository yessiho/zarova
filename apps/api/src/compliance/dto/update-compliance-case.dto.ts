import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  COMPLIANCE_CASE_STATUSES,
  COMPLIANCE_PRIORITIES,
} from '../compliance.constants.js';

export class UpdateComplianceCaseDto {
  @IsOptional()
  @IsIn(COMPLIANCE_CASE_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(COMPLIANCE_PRIORITIES)
  priority?: string;

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