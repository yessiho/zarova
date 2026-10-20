import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { LedgerService } from '../ledger/ledger.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { nowInstant } from '../prisma/temporal.js';

import { PayBillDto } from './dto/pay-bill.dto.js';

type Currency = 'NGN' | 'USD' | 'EUR' | 'GBP';

@Injectable()
export class BillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly notifications: NotificationsService,
  ) {}

  private serialize<T>(data: T): T {
    return JSON.parse(
      JSON.stringify(data, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    );
  }

  private static readonly MAX_BIGINT = 9223372036854775807n;

  private generateReference(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `BILL-${timestamp}-${random}`;
  }

  private labelForBillType(billType: string): string {
    const labels: Record<string, string> = {
      AIRTIME:     'Airtime Recharge',
      DATA:        'Data Bundle',
      ELECTRICITY: 'Electricity Bill',
      CABLE_TV:    'Cable TV Subscription',
      INTERNET:    'Internet Subscription',
    };
    return labels[billType] ?? 'Bill Payment';
  }

  /*
   * ==========================================
   * PAY BILL
   *
   * POST /bills/pay
   *
   * 1. Validate wallet ownership & balance
   * 2. Deduct balance, create Transaction + BillPayment
   * 3. Create in-app notification
   * ==========================================
   */
  async payBill(userId: number, dto: PayBillDto) {
    const amount = BigInt(dto.amount);

    if (amount <= 0n || amount > BillsService.MAX_BIGINT) {
      throw new BadRequestException('Amount must be a positive number');
    }

    try {
      const result = await this.prisma.client.transaction(async (tx: any) => {
        const wallet = await tx.orm.public.Wallet.first({
          id: dto.walletId,
          userId,
        });

        if (!wallet) throw new NotFoundException('Wallet not found');
        if (wallet.status !== 'ACTIVE') throw new BadRequestException('Wallet is not active');
        if (wallet.balance < amount) throw new BadRequestException('Insufficient wallet balance');

        const newBalance = wallet.balance - amount;
        const reference  = this.generateReference();

        const transaction = await tx.orm.public.Transaction.create({
          reference,
          _type:              'WITHDRAWAL',
          amount,
          currency:           wallet.currency,
          status:             'COMPLETED',
          sourceWalletId:     wallet.id,
          destinationWalletId: null,
          updatedAt:          nowInstant(),
        });

        await this.ledgerService.postWithdrawal(
          tx,
          transaction.id,
          amount,
          wallet.currency as Currency,
        );

        const bill = await tx.orm.public.BillPayment.create({
          reference,
          userId,
          walletId:     wallet.id,
          transactionId: transaction.id,
          billType:     dto.billType,
          provider:     dto.provider,
          recipient:    dto.recipient,
          amount,
          currency:     wallet.currency,
          status:       'COMPLETED',
          note:         dto.note ?? null,
          metadata:     JSON.stringify({ provider: dto.provider, recipient: dto.recipient }),
          updatedAt:    nowInstant(),
        });

        await tx.orm.public.Wallet.where({ id: wallet.id }).update({
          balance:   newBalance,
          updatedAt: nowInstant(),
        });

        return { bill, transaction, currency: wallet.currency as string };
      });

      const label = this.labelForBillType(dto.billType);

      await this.notifications.create({
        userId,
        title: `${label} Successful`,
        body:  `Your ${label.toLowerCase()} of ₦${dto.amount.toLocaleString()} to ${dto.recipient} via ${dto.provider} was successful.`,
        type:  'PAYMENT' as any,
        metadata: JSON.stringify({ billType: dto.billType, provider: dto.provider, amount: dto.amount }),
      });

      return this.serialize({
        message:     `${label} processed successfully`,
        bill:        result.bill,
        transaction: result.transaction,
      });
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) throw error;

      console.error('PAY BILL ERROR:', error);
      throw new InternalServerErrorException('Unable to process bill payment');
    }
  }

  /*
   * ==========================================
   * GET USER BILL HISTORY
   *
   * GET /bills
   * ==========================================
   */
  async findAll(userId: number, limit = 20, offset = 0) {
    try {
      const allBills = await this.prisma.client.orm.public.BillPayment.all();

      const userBills = allBills
        .filter((b: any) => b.userId === userId)
        .sort((a: any, b: any) => {
          const getMs = (v: any) => {
            if (v == null) return 0;
            if (typeof v === 'object' && 'epochMilliseconds' in v) return Number(v.epochMilliseconds);
            if (v instanceof Date) return v.getTime();
            return new Date(String(v)).getTime() || 0;
          };
          return getMs(b.createdAt) - getMs(a.createdAt);
        });

      const total = userBills.length;
      const data  = userBills.slice(offset, offset + limit);

      return this.serialize({ data, total });
    } catch (error) {
      console.error('FIND BILLS ERROR:', error);
      throw new InternalServerErrorException('Unable to retrieve bill history');
    }
  }

  /*
   * ==========================================
   * GET SINGLE BILL
   *
   * GET /bills/:id
   * ==========================================
   */
  async findOne(userId: number, id: number) {
    const bill = await this.prisma.client.orm.public.BillPayment.first({ id });

    if (!bill) throw new NotFoundException('Bill payment not found');
    if ((bill as any).userId !== userId) throw new NotFoundException('Bill payment not found');

    return this.serialize(bill);
  }
}
