import {
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InitializePaymentDto {
  /*
   * ==========================================
   * AMOUNT
   *
   * Amount in Naira. The service converts
   * to kobo before sending to Paystack.
   * ==========================================
   */
  @ApiProperty({
    description: 'Payment amount in Naira (will be converted to kobo)',
    example: 5000,
    minimum: 1,
  })
  @IsNumber()
  @IsPositive()
  amount: number;

  /*
   * ==========================================
   * CURRENCY
   *
   * Optional — defaults to NGN on the
   * Paystack side.
   * ==========================================
   */
  @ApiPropertyOptional({
    description: 'Payment currency (defaults to NGN)',
    example: 'NGN',
    enum: ['NGN', 'USD', 'GHS', 'ZAR'],
  })
  @IsIn(['NGN', 'USD', 'GHS', 'ZAR'])
  @IsOptional()
  currency?: string;

  /*
   * ==========================================
   * WALLET ID
   *
   * The wallet to credit on a successful
   * payment.
   * ==========================================
   */
  @ApiProperty({
    description: 'ID of the wallet to credit on successful payment',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  walletId: number;

  /*
   * ==========================================
   * METADATA
   *
   * Optional extra metadata forwarded
   * to Paystack.
   * ==========================================
   */
  @ApiPropertyOptional({
    description: 'Extra metadata to pass to Paystack',
    example: { orderId: 'ORD-123' },
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;

  /*
   * ==========================================
   * CALLBACK URL
   *
   * Where Paystack redirects the user after
   * payment. Paystack appends ?reference=...
   * and ?trxref=... automatically.
   * ==========================================
   */
  @ApiPropertyOptional({
    description: 'URL to redirect to after Paystack checkout completes',
    example: 'https://app.zarova.com/wallets',
  })
  @IsUrl({ require_tld: false })
  @IsString()
  @IsOptional()
  callbackUrl?: string;
}
