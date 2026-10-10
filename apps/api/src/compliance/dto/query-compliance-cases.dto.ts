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
  COMPLIANCE_CASE_STATUSES,
  COMPLIANCE_PRIORITIES,
} from '../compliance.constants.js';

export class QueryComplianceCasesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(COMPLIANCE_CASE_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(COMPLIANCE_PRIORITIES)
  priority?: string;

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