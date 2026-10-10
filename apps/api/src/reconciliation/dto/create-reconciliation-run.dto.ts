import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { RECONCILIATION_RUN_TYPES } from '../reconciliation.constants.js';

export class CreateReconciliationRunDto {
  @IsIn(RECONCILIATION_RUN_TYPES)
  type!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
