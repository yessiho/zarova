import { createHmac, randomBytes } from 'crypto';

import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import axios from 'axios';

import { PrismaService } from '../prisma/prisma.service.js';
import { nowInstant } from '../prisma/temporal.js';
import { InitializePaymentDto } from './dto/initialize-payment.dto.js';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /*
   * ==========================================
   * SERIALIZE DATABASE RESPONSE
   *
   * Converts BigInt values to strings so the
   * payload is JSON-serialisable.
   * ==========================================
   */
  private serialize<T>(data: T): T {
    return JSON.parse(
      JSON.stringify(data, (_, value) =>
        typeof value === 'bigint'
          ? value.toString()
          : value,
      ),
    );
  }

  /*
   * ==========================================
   * PAYSTACK SECRET KEY
   * ==========================================
   */
  private get secretKey(): string {
    return this.config.getOrThrow<string>(
      'PAYSTACK_SECRET_KEY',
    );
  }

  /*
   * ==========================================
   * AXIOS HEADERS
   * ==========================================
   */
  private get authHeaders() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  /*
   * ==========================================
   * GENERATE UNIQUE PAYMENT REFERENCE
   *
   * Format: ZAR-<16 hex chars uppercase>
   *
   * Example: ZAR-A3F1B2C4D5E6F708
   * ==========================================
   */
  private generateReference(): string {
    return `ZAR-${randomBytes(8).toString('hex').toUpperCase()}`;
  }

  /*
   * ==========================================
   * INITIALIZE PAYMENT
   *
   * POST /transaction/initialize
   *
   * Converts amount from Naira to kobo,
   * calls Paystack, and persists a PENDING
   * PaystackTransaction record.
   * ==========================================
   */
  async initializePayment(
    userId: number,
    userEmail: string,
    dto: InitializePaymentDto,
  ): Promise<any> {
    const amountKobo = Math.round(dto.amount * 100);
    const reference = this.generateReference();
    const currency = dto.currency ?? 'NGN';

    /*
     * Verify the wallet belongs to this user
     * before initiating a charge.
     */
    const wallet =
      await this.prisma.client.orm.public.Wallet.first({
        id: dto.walletId,
        userId,
      });

    if (!wallet) {
      throw new NotFoundException(
        'Wallet not found',
      );
    }

    if (wallet.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Wallet is not active',
      );
    }

    /*
     * Call Paystack initialize endpoint.
     */
    let paystackData: {
      reference: string;
      access_code: string;
      authorization_url: string;
    };

    try {
      const response = await axios.post(
        `${PAYSTACK_BASE_URL}/transaction/initialize`,
        {
          email: userEmail,
          amount: amountKobo,
          reference,
          currency,
          ...(dto.callbackUrl ? { callback_url: dto.callbackUrl } : {}),
          metadata: {
            userId,
            walletId: dto.walletId,
            ...(dto.metadata ?? {}),
          },
        },
        { headers: this.authHeaders },
      );

      paystackData = response.data?.data;
    } catch (error: any) {
      this.logger.error(
        'Paystack initialize failed',
        error?.response?.data ?? error.message,
      );

      throw new InternalServerErrorException(
        'Unable to initialize payment with Paystack',
      );
    }

    /*
     * Persist a PENDING transaction record.
     */
    const tx =
      await this.prisma.client.orm.public.PaystackTransaction.create({
        reference,
        userId,
        walletId: dto.walletId,
        amount: BigInt(amountKobo),
        currency,
        email: userEmail,
        status: 'PENDING',
        accessCode: paystackData.access_code,
        authorizationUrl: paystackData.authorization_url,
        metadata: JSON.stringify({
          userId,
          walletId: dto.walletId,
          ...(dto.metadata ?? {}),
        }),
        updatedAt: nowInstant(),
      });

    this.logger.log(
      `Payment initialized: ${reference} for user ${userId}`,
    );

    return this.serialize({
      reference: tx.reference,
      authorizationUrl: paystackData.authorization_url,
      accessCode: paystackData.access_code,
    });
  }

  /*
   * ==========================================
   * CREDIT WALLET ON SUCCESS
   *
   * Internal helper. Adds the paid amount to
   * the wallet balance and emits WALLET_FUNDED.
   * ==========================================
   */
  private async creditWallet(
    walletId: number,
    amountKobo: bigint,
  ): Promise<void> {
    const wallet =
      await this.prisma.client.orm.public.Wallet.first({
        id: walletId,
      });

    if (!wallet) {
      this.logger.error(
        `Wallet ${walletId} not found during credit`,
      );
      return;
    }

    const newBalance = wallet.balance + amountKobo;

    await this.prisma.client.orm.public.Wallet
      .where({ id: walletId })
      .update({
        balance: newBalance,
        updatedAt: nowInstant(),
      });

    this.logger.log(
      `Wallet ${walletId} credited ${amountKobo} kobo`,
    );

    this.eventEmitter.emit('WALLET_FUNDED', {
      walletId,
      amount: amountKobo.toString(),
    });
  }

  /*
   * ==========================================
   * APPLY PAYSTACK VERIFICATION RESULT
   *
   * Shared logic used by both verifyPayment()
   * and handleWebhook().
   * ==========================================
   */
  private async applyVerificationResult(
    localTx: any,
    paystackStatus: string,
    gatewayData: {
      gateway_response: string;
      reference: string;
      paid_at?: string;
      channel?: string;
    },
  ): Promise<any> {
    /*
     * Already resolved — nothing to do.
     */
    if (localTx.status !== 'PENDING') {
      return this.serialize(localTx);
    }

    if (paystackStatus === 'success') {
      const updatedTx =
        await this.prisma.client.orm.public.PaystackTransaction
          .where({ reference: localTx.reference })
          .update({
            status: 'SUCCESS',
            gatewayReference: gatewayData.reference,
            channel: gatewayData.channel ?? null,
            paidAt: gatewayData.paid_at
              ? nowInstant()
              : null,
            updatedAt: nowInstant(),
          });

      /*
       * Credit the wallet if one is linked.
       */
      if (localTx.walletId) {
        await this.creditWallet(
          localTx.walletId,
          localTx.amount,
        );
      }

      return this.serialize(updatedTx);
    }

    /*
     * Map Paystack terminal failure states.
     */
    const newStatus =
      paystackStatus === 'abandoned'
        ? 'ABANDONED'
        : 'FAILED';

    const updatedTx =
      await this.prisma.client.orm.public.PaystackTransaction
        .where({ reference: localTx.reference })
        .update({
          status: newStatus,
          failureReason: gatewayData.gateway_response,
          updatedAt: nowInstant(),
        });

    return this.serialize(updatedTx);
  }

  /*
   * ==========================================
   * VERIFY PAYMENT
   *
   * GET /transaction/verify/:reference
   *
   * Called by the frontend after redirect
   * from Paystack's hosted checkout page.
   * ==========================================
   */
  async verifyPayment(
    reference: string,
    userId: number,
  ): Promise<any> {
    /*
     * Look up our own record first.
     */
    const localTx =
      await this.prisma.client.orm.public.PaystackTransaction.first({
        reference,
      });

    if (!localTx) {
      throw new NotFoundException(
        'Payment transaction not found',
      );
    }

    if (localTx.userId !== userId) {
      throw new NotFoundException(
        'Payment transaction not found',
      );
    }

    /*
     * Query Paystack for the current status.
     */
    let gatewayData: any;

    try {
      const response = await axios.get(
        `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: this.authHeaders },
      );

      gatewayData = response.data?.data;
    } catch (error: any) {
      this.logger.error(
        `Paystack verify failed for ${reference}`,
        error?.response?.data ?? error.message,
      );

      throw new InternalServerErrorException(
        'Unable to verify payment with Paystack',
      );
    }

    return this.applyVerificationResult(
      localTx,
      gatewayData.status,
      gatewayData,
    );
  }

  /*
   * ==========================================
   * HANDLE PAYSTACK WEBHOOK
   *
   * POST /paystack/webhook (public route)
   *
   * Verifies HMAC-SHA512 signature, then
   * processes charge.success events.
   * ==========================================
   */
  async handleWebhook(
    signature: string,
    rawBody: Buffer,
  ): Promise<void> {
    /*
     * Verify signature.
     */
    const expectedSignature = createHmac(
      'sha512',
      this.secretKey,
    )
      .update(rawBody)
      .digest('hex');

    if (signature !== expectedSignature) {
      this.logger.warn(
        'Paystack webhook signature mismatch',
      );
      throw new UnauthorizedException(
        'Invalid webhook signature',
      );
    }

    let event: { event: string; data: any };

    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException(
        'Invalid webhook payload',
      );
    }

    this.logger.log(
      `Paystack webhook received: ${event.event}`,
    );

    if (event.event === 'charge.success') {
      const data = event.data;
      const reference: string = data?.reference;

      if (!reference) {
        this.logger.warn(
          'charge.success webhook missing reference',
        );
        return;
      }

      const localTx =
        await this.prisma.client.orm.public.PaystackTransaction.first({
          reference,
        });

      if (!localTx) {
        this.logger.warn(
          `charge.success: no local tx found for reference ${reference}`,
        );
        return;
      }

      await this.applyVerificationResult(
        localTx,
        data.status,
        data,
      );

      return;
    }

    this.logger.log(
      `Unhandled Paystack webhook event: ${event.event}`,
    );
  }

  /*
   * ==========================================
   * FIND ALL TRANSACTIONS FOR USER
   *
   * GET /paystack
   * ==========================================
   */
  async findAllForUser(userId: number): Promise<any[]> {
    const transactions =
      await this.prisma.client.orm.public.PaystackTransaction
        .where({ userId })
        .all();

    return this.serialize(transactions);
  }

  /*
   * ==========================================
   * FIND ONE TRANSACTION
   *
   * GET /paystack/:reference
   * ==========================================
   */
  async findOne(
    reference: string,
    userId: number,
  ): Promise<any> {
    const tx =
      await this.prisma.client.orm.public.PaystackTransaction.first({
        reference,
      });

    if (!tx) {
      throw new NotFoundException(
        'Payment transaction not found',
      );
    }

    if (tx.userId !== userId) {
      throw new NotFoundException(
        'Payment transaction not found',
      );
    }

    return this.serialize(tx);
  }
}
