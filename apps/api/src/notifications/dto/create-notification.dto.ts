import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export enum NotificationType {
  TRANSACTION = 'TRANSACTION',
  SECURITY = 'SECURITY',
  SYSTEM = 'SYSTEM',
  COMPLIANCE = 'COMPLIANCE',
  PAYMENT = 'PAYMENT',
}

export class CreateNotificationDto {
  @IsNumber()
  userId: number;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsOptional()
  @IsString()
  metadata?: string;
}
