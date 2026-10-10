import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service.js';

import { AuditService } from '../audit/audit.service.js';

import { nowInstant } from '../prisma/temporal.js';

import { LedgerService } from '../ledger/ledger.service.js';

import { QueryAdminPaymentsDto } from './dto/query-admin-payments.dto.js';

import { CreateAdminPaymentDto } from './dto/create-admin-payment.dto.js';

@Injectable()
export class AdminPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly ledgerService: LedgerService,
  ) {}

  /* ==========================================================
     SERIALIZATION
     ========================================================== */

  private serialize(value: unknown): unknown {
    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (
      value &&
      typeof value === 'object' &&
      'epochMilliseconds' in value
    ) {
      const milliseconds = (
        value as {
          epochMilliseconds?: unknown;
        }
      ).epochMilliseconds;

      if (
        typeof milliseconds === 'number' &&
        Number.isFinite(milliseconds)
      ) {
        return new Date(
          milliseconds,
        ).toISOString();
      }
    }

    if (Array.isArray(value)) {
      return value.map((item) =>
        this.serialize(item),
      );
    }

    if (
      value &&
      typeof value === 'object'
    ) {
      const result: Record<
        string,
        unknown
      > = {};

      for (const [
        key,
        item,
      ] of Object.entries(
        value as Record<
          string,
          unknown
        >,
      )) {
        result[key] =
          this.serialize(item);
      }

      return result;
    }

    return value;
  }

  /* ==========================================================
     TIMESTAMP HELPER
     ========================================================== */

  private getTimestampMilliseconds(
    value: any,
  ): number {
    if (!value) {
      return 0;
    }

    if (
      typeof value === 'object' &&
      'epochMilliseconds' in value
    ) {
      return Number(
        value.epochMilliseconds,
      );
    }

    if (value instanceof Date) {
      return value.getTime();
    }

    return (
      new Date(
        String(value),
      ).getTime() || 0
    );
  }

  /* ==========================================================
     ADMIN AND WALLET LOOKUPS
     ========================================================== */

  private async getAdmin(
    adminId: number | null,
  ) {
    if (!adminId) {
      return null;
    }

    return this.prisma.client.orm.public.Admin.first(
      {
        id: adminId,
      },
    );
  }

  private async getWallet(
    walletId: number | null,
  ) {
    if (!walletId) {
      return null;
    }

    return this.prisma.client.orm.public.Wallet.first(
      {
        id: walletId,
      },
    );
  }

  /* ==========================================================
     CREATE PAYMENT REQUEST
     ========================================================== */

  async create(
    dto: CreateAdminPaymentDto,
    adminId: number,
  ) {
    /*
     * Validate administrator.
     */

    const admin =
      await this.getAdmin(adminId);

    if (
      !admin ||
      admin.status !== 'ACTIVE'
    ) {
      throw new BadRequestException(
        'Active administrator account required',
      );
    }

    /*
     * Prevent transfers to the same wallet.
     */

    if (
      dto.sourceWalletId ===
      dto.destinationWalletId
    ) {
      throw new BadRequestException(
        'Source and destination wallets must be different',
      );
    }

    /*
     * Fetch both wallets.
     */

    const [
      sourceWallet,
      destinationWallet,
    ] = await Promise.all([
      this.getWallet(
        dto.sourceWalletId,
      ),
      this.getWallet(
        dto.destinationWalletId,
      ),
    ]);

    if (
      !sourceWallet ||
      !destinationWallet
    ) {
      throw new NotFoundException(
        'Source or destination wallet not found',
      );
    }

    /*
     * Validate wallet status.
     */

    if (
      sourceWallet.status !==
        'ACTIVE' ||
      destinationWallet.status !==
        'ACTIVE'
    ) {
      throw new BadRequestException(
        'Both wallets must be active',
      );
    }

    /*
     * Validate currency.
     */

    if (
      sourceWallet.currency !==
        dto.currency ||
      destinationWallet.currency !==
        dto.currency
    ) {
      throw new BadRequestException(
        'Payment currency must match both wallet currencies',
      );
    }

    /*
     * Validate amount.
     *
     * Amounts are stored in minor units.
     */

    if (
      !/^[1-9]\d*$/.test(
        dto.amount,
      )
    ) {
      throw new BadRequestException(
        'Amount must be a positive integer in minor units',
      );
    }

    const amount =
      BigInt(dto.amount);

    /*
     * Generate unique payment reference.
     */

    const reference =
      `PAY-${Date.now()}-${randomUUID()
        .replace(/-/g, '')
        .slice(0, 12)
        .toUpperCase()}`;

    /*
     * Create payment request.
     */

    const payment =
      await this.prisma.client.orm.public.Payment.create(
        {
          reference,

          sourceWalletId:
            dto.sourceWalletId,

          destinationWalletId:
            dto.destinationWalletId,

          amount,

          currency:
            dto.currency,

          description:
            dto.description?.trim() ||
            null,

          status: 'PENDING',

          createdByAdminId:
            adminId,

          approvedByAdminId:
            null,

          rejectedByAdminId:
            null,

          rejectionReason:
            null,

          transactionId:
            null,

          updatedAt:
            nowInstant(),
        },
      );

    /*
     * Record audit log.
     */

    await this.auditService.create({
      adminId,

      action:
        'PAYMENT_CREATED',

      entity:
        'Payment',

      entityId:
        String(payment.id),

      metadata:
        JSON.stringify({
          reference,

          sourceWalletId:
            dto.sourceWalletId,

          destinationWalletId:
            dto.destinationWalletId,

          amount:
            dto.amount,

          currency:
            dto.currency,

          status:
            'PENDING',
        }),
    });

    return this.serialize({
      message:
        'Payment request created successfully',

      payment,
    });
  }

  /* ==========================================================
     APPROVE PAYMENT
     ========================================================== */

  async approve(
    id: number,
    adminId: number,
  ) {
    /*
     * Validate administrator.
     */

    const admin =
      await this.getAdmin(adminId);

    if (
      !admin ||
      admin.status !== 'ACTIVE'
    ) {
      throw new BadRequestException(
        'Active administrator account required',
      );
    }

    /*
     * Load payment.
     */

    const payment =
      await this.prisma.client.orm.public.Payment.first(
        {
          id,
        },
      );

    if (!payment) {
      throw new NotFoundException(
        'Payment not found',
      );
    }

    /*
     * Maker-checker:
     * creator cannot approve own payment.
     */

    if (
      payment.createdByAdminId ===
      adminId
    ) {
      throw new BadRequestException(
        'You cannot approve a payment you created',
      );
    }

    /*
     * Only PENDING payments can be approved.
     */

    if (
      payment.status !== 'PENDING'
    ) {
      throw new BadRequestException(
        `Only PENDING payments can be approved. Current status: ${payment.status}`,
      );
    }

    /*
     * Revalidate wallet status before approval.
     */

    const [
      sourceWallet,
      destinationWallet,
    ] = await Promise.all([
      this.getWallet(
        payment.sourceWalletId,
      ),

      this.getWallet(
        payment.destinationWalletId,
      ),
    ]);

    if (
      !sourceWallet ||
      !destinationWallet
    ) {
      throw new NotFoundException(
        'Source or destination wallet not found',
      );
    }

    if (
      sourceWallet.status !==
        'ACTIVE' ||
      destinationWallet.status !==
        'ACTIVE'
    ) {
      throw new BadRequestException(
        'Both wallets must be active before approval',
      );
    }

    if (
      sourceWallet.currency !==
        payment.currency ||
      destinationWallet.currency !==
        payment.currency
    ) {
      throw new BadRequestException(
        'Payment currency does not match wallet currencies',
      );
    }

    const timestamp =
      nowInstant();

    /*
     * Conditional update prevents
     * duplicate approval decisions.
     */

    const updated =
      await this.prisma.client.orm.public.Payment
        .where({
          id,

          status:
            'PENDING',
        })
        .update({
          status:
            'APPROVED',

          approvedByAdminId:
            adminId,

          approvedAt:
            timestamp,

          updatedAt:
            timestamp,
        });

    if (!updated) {
      throw new BadRequestException(
        'Payment is no longer pending. Refresh and try again.',
      );
    }

    /*
     * Record audit log.
     */

    await this.auditService.create({
      adminId,

      action:
        'PAYMENT_APPROVED',

      entity:
        'Payment',

      entityId:
        String(id),

      metadata:
        JSON.stringify({
          reference:
            payment.reference,

          previousStatus:
            'PENDING',

          newStatus:
            'APPROVED',

          createdByAdminId:
            payment.createdByAdminId,
        }),
    });

    const updatedPayment =
      await this.prisma.client.orm.public.Payment.first(
        {
          id,
        },
      );

    return this.serialize({
      message:
        'Payment approved successfully',

      payment:
        updatedPayment,
    });
  }

  /* ==========================================================
     REJECT PAYMENT
     ========================================================== */

  async reject(
    id: number,
    adminId: number,
    reason: string,
  ) {
    /*
     * Validate administrator.
     */

    const admin =
      await this.getAdmin(adminId);

    if (
      !admin ||
      admin.status !== 'ACTIVE'
    ) {
      throw new BadRequestException(
        'Active administrator account required',
      );
    }

    /*
     * Load payment.
     */

    const payment =
      await this.prisma.client.orm.public.Payment.first(
        {
          id,
        },
      );

    if (!payment) {
      throw new NotFoundException(
        'Payment not found',
      );
    }

    /*
     * Maker-checker:
     * creator cannot reject own payment.
     */

    if (
      payment.createdByAdminId ===
      adminId
    ) {
      throw new BadRequestException(
        'You cannot reject a payment you created',
      );
    }

    /*
     * Only PENDING payments can be rejected.
     */

    if (
      payment.status !== 'PENDING'
    ) {
      throw new BadRequestException(
        `Only PENDING payments can be rejected. Current status: ${payment.status}`,
      );
    }

    const rejectionReason =
      reason?.trim();

    if (!rejectionReason) {
      throw new BadRequestException(
        'A rejection reason is required',
      );
    }

    if (
      rejectionReason.length > 500
    ) {
      throw new BadRequestException(
        'Rejection reason cannot exceed 500 characters',
      );
    }

    const timestamp =
      nowInstant();

    /*
     * Conditional update prevents
     * duplicate rejection decisions.
     */

    const updated =
      await this.prisma.client.orm.public.Payment
        .where({
          id,

          status:
            'PENDING',
        })
        .update({
          status:
            'REJECTED',

          rejectedByAdminId:
            adminId,

          rejectionReason,

          rejectedAt:
            timestamp,

          updatedAt:
            timestamp,
        });

    if (!updated) {
      throw new BadRequestException(
        'Payment is no longer pending. Refresh and try again.',
      );
    }

    /*
     * Record audit log.
     */

    await this.auditService.create({
      adminId,

      action:
        'PAYMENT_REJECTED',

      entity:
        'Payment',

      entityId:
        String(id),

      metadata:
        JSON.stringify({
          reference:
            payment.reference,

          previousStatus:
            'PENDING',

          newStatus:
            'REJECTED',

          rejectionReason,

          createdByAdminId:
            payment.createdByAdminId,
        }),
    });

    const updatedPayment =
      await this.prisma.client.orm.public.Payment.first(
        {
          id,
        },
      );

    return this.serialize({
      message:
        'Payment rejected successfully',

      payment:
        updatedPayment,
    });
  }

  /* ==========================================================
     EXECUTE APPROVED PAYMENT
     ========================================================== */

  async execute(
    id: number,
    adminId: number,
  ) {
    /*
     * Validate administrator before beginning
     * the financial transaction.
     */

    const admin =
      await this.getAdmin(adminId);

    if (
      !admin ||
      admin.status !== 'ACTIVE'
    ) {
      throw new BadRequestException(
        'Active administrator account required',
      );
    }

    /*
     * Everything below this point is executed
     * inside one database transaction.
     *
     * If any operation fails:
     *
     * - Payment claim rolls back
     * - Transaction rolls back
     * - Ledger entries roll back
     * - Source wallet update rolls back
     * - Destination wallet update rolls back
     *
     * The payment therefore does not get stuck
     * in PROCESSING because of an execution failure.
     */

    const result =
      await this.prisma.client.transaction(
        async (tx: any) => {
          /*
           * Load payment inside transaction.
           */

          const payment =
            await tx.orm.public.Payment.first(
              {
                id,
              },
            );

          if (!payment) {
            throw new NotFoundException(
              'Payment not found',
            );
          }

          /*
           * Only APPROVED payments can execute.
           */

          if (
            payment.status !==
            'APPROVED'
          ) {
            throw new BadRequestException(
              `Only APPROVED payments can be executed. Current status: ${payment.status}`,
            );
          }

          /*
           * Protect against duplicate execution.
           */

          if (
            payment.transactionId
          ) {
            throw new BadRequestException(
              'Payment has already been executed',
            );
          }

          /*
           * Atomically claim the payment.
           *
           * This is the maker/checker execution
           * concurrency guard.
           */

          const claimed =
            await tx.orm.public.Payment
              .where({
                id,

                status:
                  'APPROVED',

                transactionId:
                  null,
              })
              .update({
                status:
                  'PROCESSING',

                updatedAt:
                  nowInstant(),
              });

          if (!claimed) {
            throw new BadRequestException(
              'Payment is already being processed or is no longer approved',
            );
          }

          /*
           * Load source wallet.
           */

          const sourceWallet =
            await tx.orm.public.Wallet.first(
              {
                id: payment.sourceWalletId,
              },
            );

          /*
           * Load destination wallet.
           */

          const destinationWallet =
            await tx.orm.public.Wallet.first(
              {
                id:
                  payment.destinationWalletId,
              },
            );

          if (
            !sourceWallet ||
            !destinationWallet
          ) {
            throw new NotFoundException(
              'Source or destination wallet not found',
            );
          }

          /*
           * Wallets must be different.
           */

          if (
            sourceWallet.id ===
            destinationWallet.id
          ) {
            throw new BadRequestException(
              'Source and destination wallets must be different',
            );
          }

          /*
           * Wallets must remain active
           * at execution time.
           */

          if (
            sourceWallet.status !==
              'ACTIVE' ||
            destinationWallet.status !==
              'ACTIVE'
          ) {
            throw new BadRequestException(
              'Both wallets must be active',
            );
          }

          /*
           * Currency must remain consistent.
           */

          if (
            sourceWallet.currency !==
              payment.currency ||
            destinationWallet.currency !==
              payment.currency
          ) {
            throw new BadRequestException(
              'Payment currency does not match wallet currencies',
            );
          }

          /*
           * Validate payment amount.
           */

          const amount =
            BigInt(payment.amount);

          if (amount <= 0n) {
            throw new BadRequestException(
              'Payment amount must be positive',
            );
          }

          /*
           * Check source wallet balance.
           */

          if (
            sourceWallet.balance <
            amount
          ) {
            throw new BadRequestException(
              'Insufficient wallet balance',
            );
          }

          /*
           * Create financial transaction.
           *
           * This happens inside the same transaction
           * as the wallet and ledger changes.
           */

          const transaction =
            await tx.orm.public.Transaction.create(
              {
                reference:
                  `TXN-${payment.reference}`,

                _type:
                  'TRANSFER',

                amount,

                currency:
                  payment.currency,

                status:
                  'COMPLETED',

                sourceWalletId:
                  sourceWallet.id,

                destinationWalletId:
                  destinationWallet.id,

                updatedAt:
                  nowInstant(),
              },
            );

          /*
           * Post balanced double-entry ledger entries.
           *
           * Source wallet:
           *     DEBIT
           *
           * Destination wallet:
           *     CREDIT
           *
           * Both entries are created inside the
           * same database transaction.
           */

          await this.ledgerService.postWalletPayment(
            tx,

            transaction.id,

            sourceWallet.id,

            destinationWallet.id,

            amount,

            payment.currency,
          );

          /*
           * Debit source wallet.
           *
           * The WHERE clause includes the original
           * balance to protect against concurrent
           * balance modifications.
           */

          const sourceUpdated =
            await tx.orm.public.Wallet
              .where({
                id:
                  sourceWallet.id,

                balance:
                  sourceWallet.balance,
              })
              .update({
                balance:
                  sourceWallet.balance -
                  amount,

                updatedAt:
                  nowInstant(),
              });

          if (!sourceUpdated) {
            throw new BadRequestException(
              'Source wallet balance changed during execution. Please retry the payment.',
            );
          }

          /*
           * Credit destination wallet.
           *
           * The original destination balance is
           * also used as a concurrency guard.
           */

          const destinationUpdated =
            await tx.orm.public.Wallet
              .where({
                id:
                  destinationWallet.id,

                balance:
                  destinationWallet.balance,
              })
              .update({
                balance:
                  destinationWallet.balance +
                  amount,

                updatedAt:
                  nowInstant(),
              });

          if (
            !destinationUpdated
          ) {
            throw new BadRequestException(
              'Destination wallet balance changed during execution. Please retry the payment.',
            );
          }

          /*
           * Finalize payment only after all
           * financial operations succeeded.
           */

          const completedPayment =
            await tx.orm.public.Payment
              .where({
                id,

                status:
                  'PROCESSING',

                transactionId:
                  null,
              })
              .update({
                status:
                  'COMPLETED',

                transactionId:
                  transaction.id,

                updatedAt:
                  nowInstant(),
              });

          if (
            !completedPayment
          ) {
            throw new BadRequestException(
              'Unable to finalize payment',
            );
          }

          return {
            payment:
              completedPayment,

            transaction,
          };
        },
      );

    /*
     * Audit after the financial transaction
     * successfully commits.
     */

    await this.auditService.create({
      adminId,

      action:
        'PAYMENT_EXECUTED',

      entity:
        'Payment',

      entityId:
        String(id),

      metadata:
        JSON.stringify({
          transactionId:
            result.transaction.id,

          reference:
            result.payment.reference,

          previousStatus:
            'APPROVED',

          newStatus:
            'COMPLETED',
        }),
    });

    return this.serialize({
      message:
        'Payment executed successfully',

      ...result,
    });
  }

  /* ==========================================================
     BUILD PAYMENT DETAILS
     ========================================================== */

  private async buildPayment(
    payment: any,
  ) {
    const [
      sourceWallet,
      destinationWallet,
      creator,
      approver,
      rejector,
    ] = await Promise.all([
      this.getWallet(
        payment.sourceWalletId,
      ),

      this.getWallet(
        payment.destinationWalletId,
      ),

      this.getAdmin(
        payment.createdByAdminId,
      ),

      this.getAdmin(
        payment.approvedByAdminId,
      ),

      this.getAdmin(
        payment.rejectedByAdminId,
      ),
    ]);

    return {
      ...payment,

      sourceWallet:
        sourceWallet
          ? {
              id:
                sourceWallet.id,

              currency:
                sourceWallet.currency,

              status:
                sourceWallet.status,
            }
          : null,

      destinationWallet:
        destinationWallet
          ? {
              id:
                destinationWallet.id,

              currency:
                destinationWallet.currency,

              status:
                destinationWallet.status,
            }
          : null,

      createdBy:
        creator
          ? {
              id:
                creator.id,

              firstName:
                creator.firstName,

              lastName:
                creator.lastName,

              email:
                creator.email,
            }
          : null,

      approvedBy:
        approver
          ? {
              id:
                approver.id,

              firstName:
                approver.firstName,

              lastName:
                approver.lastName,

              email:
                approver.email,
            }
          : null,

      rejectedBy:
        rejector
          ? {
              id:
                rejector.id,

              firstName:
                rejector.firstName,

              lastName:
                rejector.lastName,

              email:
                rejector.email,
            }
          : null,
    };
  }

  /* ==========================================================
     GET ALL PAYMENTS
     ========================================================== */

  async findAll(
    query: QueryAdminPaymentsDto,
  ) {
    const {
      search,
      status,
      currency,
      page = 1,
      limit = 20,
    } = query;

    const payments =
      await this.prisma.client.orm.public.Payment.all();

    const normalizedSearch =
      search
        ?.trim()
        .toLowerCase();

    const filtered =
      payments.filter(
        (payment: any) => {
          /*
           * Status filter.
           */

          if (
            status &&
            payment.status !==
              status
          ) {
            return false;
          }

          /*
           * Currency filter.
           */

          if (
            currency &&
            payment.currency !==
              currency
          ) {
            return false;
          }

          /*
           * Search.
           */

          if (
            normalizedSearch
          ) {
            const searchable = [
              String(
                payment.id,
              ),

              payment.reference,

              payment.description,

              payment.status,

              payment.currency,

              String(
                payment.sourceWalletId,
              ),

              String(
                payment.destinationWalletId,
              ),
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();

            if (
              !searchable.includes(
                normalizedSearch,
              )
            ) {
              return false;
            }
          }

          return true;
        },
      );

    /*
     * Sort newest first.
     */

    filtered.sort(
      (a: any, b: any) =>
        this.getTimestampMilliseconds(
          b.createdAt,
        ) -
        this.getTimestampMilliseconds(
          a.createdAt,
        ),
    );

    const total =
      filtered.length;

    const skip =
      (page - 1) *
      limit;

    const paginated =
      filtered.slice(
        skip,
        skip + limit,
      );

    const data = [];

    for (
      const payment of paginated
    ) {
      data.push(
        await this.buildPayment(
          payment,
        ),
      );
    }

    /*
     * Payment statistics.
     */

    const statistics = {
      totalPayments:
        filtered.length,

      pendingPayments:
        filtered.filter(
          (payment: any) =>
            payment.status ===
            'PENDING',
        ).length,

      approvedPayments:
        filtered.filter(
          (payment: any) =>
            payment.status ===
            'APPROVED',
        ).length,

      rejectedPayments:
        filtered.filter(
          (payment: any) =>
            payment.status ===
            'REJECTED',
        ).length,

      processingPayments:
        filtered.filter(
          (payment: any) =>
            payment.status ===
            'PROCESSING',
        ).length,

      completedPayments:
        filtered.filter(
          (payment: any) =>
            payment.status ===
            'COMPLETED',
        ).length,

      failedPayments:
        filtered.filter(
          (payment: any) =>
            payment.status ===
            'FAILED',
        ).length,
    };

    return this.serialize({
      data,

      pagination: {
        page,

        limit,

        total,

        totalPages:
          Math.ceil(
            total / limit,
          ),
      },

      statistics,
    });
  }

  /* ==========================================================
     GET PAYMENT BY ID
     ========================================================== */

  async findOne(
    id: number,
  ) {
    const payment =
      await this.prisma.client.orm.public.Payment.first(
        {
          id,
        },
      );

    if (!payment) {
      throw new NotFoundException(
        'Payment not found',
      );
    }

    const result =
      await this.buildPayment(
        payment,
      );

    return this.serialize({
      payment:
        result,
    });
  }
}