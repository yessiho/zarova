import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
} from 'class-validator';

import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class SubmitKycDto {
  @ApiProperty({
    description: 'First name as on the identity document',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({
    description: 'Last name as on the identity document',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({
    description: 'Date of birth in YYYY-MM-DD format',
    example: '1990-06-15',
  })
  @IsString()
  @Matches(
    /^\d{4}-\d{2}-\d{2}$/,
    {
      message:
        'dateOfBirth must be in YYYY-MM-DD format',
    },
  )
  dateOfBirth!: string;

  @ApiProperty({
    description: 'Nationality (country of citizenship)',
    example: 'Nigerian',
  })
  @IsString()
  @IsNotEmpty()
  nationality!: string;

  @ApiProperty({
    description: 'Type of identity document',
    enum: [
      'PASSPORT',
      'NATIONAL_ID',
      'DRIVERS_LICENSE',
    ],
  })
  @IsString()
  @IsIn([
    'PASSPORT',
    'NATIONAL_ID',
    'DRIVERS_LICENSE',
  ])
  documentType!: string;

  @ApiProperty({
    description: 'Identity document number',
    example: 'A12345678',
  })
  @IsString()
  @IsNotEmpty()
  documentNumber!: string;

  @ApiProperty({
    description:
      'URL of the front image of the identity document',
    example:
      'https://storage.example.com/kyc/doc-front.jpg',
  })
  @IsString()
  @IsUrl()
  documentFrontUrl!: string;

  @ApiPropertyOptional({
    description:
      'URL of the back image of the identity document (optional for passports)',
    example:
      'https://storage.example.com/kyc/doc-back.jpg',
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  documentBackUrl?: string;

  @ApiPropertyOptional({
    description: 'URL of a selfie photo for liveness check',
    example:
      'https://storage.example.com/kyc/selfie.jpg',
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  selfieUrl?: string;

  @ApiPropertyOptional({
    description: 'Residential address',
    example: '12 Marina Road, Lagos, Nigeria',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'KYC tier being applied for (defaults to BASIC)',
    enum: ['BASIC', 'STANDARD', 'PREMIUM'],
    default: 'BASIC',
  })
  @IsOptional()
  @IsString()
  @IsIn(['BASIC', 'STANDARD', 'PREMIUM'])
  tier?: string;
}
