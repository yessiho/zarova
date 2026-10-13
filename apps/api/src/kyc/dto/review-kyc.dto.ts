import {
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class ReviewKycDto {
  @ApiProperty({
    description: 'New status to apply to the KYC submission',
    enum: ['UNDER_REVIEW', 'APPROVED', 'REJECTED'],
  })
  @IsString()
  @IsIn([
    'UNDER_REVIEW',
    'APPROVED',
    'REJECTED',
  ])
  status!: string;

  @ApiPropertyOptional({
    description:
      'Notes from the reviewer explaining the decision (required when rejecting)',
    example:
      'Document appears valid. Identity confirmed.',
  })
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
