import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { LedgerService } from '../ledger/ledger.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { CreateWalletDto } from './dto/create-wallet.dto.js';
import { DepositDto } from './dto/deposit.dto.js';
import { WithdrawDto } from './dto/withdraw.dto.js';
import { TransferDto } from './dto/transfer.dto.js';
import { nowInstant } from '../prisma/temporal.js';

type WalletCurrency = 'NGN' | 'USD' | 'EUR' | 'GBP';

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  /*
   * ==========================================
   * SERIALIZE DATABASE RESPONSE
   *
   * PostgreSQL / Prisma may return BigInt values.
   * JSON.stringify cannot serialize BigInt directly.
   *
   * Convert:
   *
   * 1000n → "1000"
   *
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

  private static readonly MAX_BIGINT =
    9223372036854775807n;

  private parseAmount(
    value: unknown,
    fieldName: string,
  ): bigint {
    if (typeof value === 'bigint') {
      if (
        value <= 0n ||
        value > WalletsService.MAX_BIGINT
      ) {
        throw new BadRequestException(
          `${fieldName} must be greater than 0 and within the supported amount range`,
        );
      }

      return value;
    }

    if (typeof value === 'number') {
      if (
        !Number.isFinite(value) ||
        !Number.isInteger(value) ||
        !Number.isSafeInteger(value) ||
        value <= 0
      ) {
        throw new BadRequestException(
          `${fieldName} must be a positive whole number`,
        );
      }

      const amount = BigInt(value);

      if (amount > WalletsService.MAX_BIGINT) {
        throw new BadRequestException(
          `${fieldName} exceeds the maximum supported amount`,
        );
      }

      return amount;
    }

    if (typeof value === 'string') {
      const normalized = value.trim();

      if (!/^\d+$/.test(normalized)) {
        throw new BadRequestException(
          `${fieldName} must be a positive whole number`,
        );
      }

      let amount: bigint;

      try {
        amount = BigInt(normalized);
      } catch {
        throw new BadRequestException(
          `${fieldName} is invalid`,
        );
      }

      if (amount <= 0n) {
        throw new BadRequestException(
          `${fieldName} must be greater than 0`,
        );
      }

      if (amount > WalletsService.MAX_BIGINT) {
        throw new BadRequestException(
          `${fieldName} exceeds the maximum supported amount`,
        );
      }

      return amount;
    }

    throw new BadRequestException(
      `${fieldName} must be a positive whole number`,
    );
  }

  /*
   * ==========================================
   * GENERATE WALLET ACCOUNT NUMBER
   *
   * Demo banking account number.
   *
   * Format:
   *
   * 10 digits
   *
   * Example:
   *
   * 1045827391
   *
   * ==========================================
   */
  private generateAccountNumber(): string {
    const firstDigit = Math.floor(Math.random() * 9) + 1;

    let remainingDigits = '';

    for (let i = 0; i < 9; i++) {
      remainingDigits += Math.floor(
        Math.random() * 10,
      ).toString();
    }

    return `${firstDigit}${remainingDigits}`;
  }

  /*
   * ==========================================
   * GENERATE TRANSACTION REFERENCE
   * ==========================================
   */
  private generateReference(
    prefix: string,
  ): string {
    const timestamp = Date.now();

    const random = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();

    return `${prefix}-${timestamp}-${random}`;
  }

  /*
   * ==========================================
   * GENERATE UNIQUE ACCOUNT NUMBER
   *
   * Check database before returning number.
   *
   * Maximum attempts prevents infinite loops.
   * ==========================================
   */
  private async generateUniqueAccountNumber(): Promise<string> {
    const maxAttempts = 20;

    for (
      let attempt = 0;
      attempt < maxAttempts;
      attempt++
    ) {
      const accountNumber =
        this.generateAccountNumber();

      const existingAccount =
        await this.prisma.client.orm.public.WalletAccount.first({
          accountNumber,
        });

      if (!existingAccount) {
        return accountNumber;
      }
    }

    throw new InternalServerErrorException(
      'Unable to generate a unique account number',
    );
  }

  /*
   * ==========================================
   * GET WALLET OWNER
   *
   * Used when automatically creating
   * a wallet account.
   * ==========================================
   */
  private async getWalletOwner(
    userId: number,
  ) {
    const user =
      await this.prisma.client.orm.public.User.first({
        id: userId,
      });

    if (!user) {
      throw new NotFoundException(
        'Wallet owner not found',
      );
    }

    return user;
  }

  /*
   * ==========================================
   * ENSURE WALLET HAS ACCOUNT
   *
   * This is the most important method.
   *
   * It supports:
   *
   * 1. New wallets
   * 2. Existing wallets
   * 3. Existing users created before
   *    WalletAccount was introduced
   *
   * Logic:
   *
   * Wallet
   *   ↓
   * Does account exist?
   *   ↓
   * YES → Return account
   *
   * NO
   *   ↓
   * Automatically create account
   *
   * ==========================================
   */
  private async ensureWalletAccount(
    wallet: any,
  ) {
    /*
     * First check whether account already exists.
     */
    const existingAccount =
      await this.prisma.client.orm.public.WalletAccount.first({
        walletId: wallet.id,
      });

    if (existingAccount) {
      return existingAccount;
    }

    /*
     * Get wallet owner.
     */
    const user =
      await this.getWalletOwner(
        wallet.userId,
      );

    /*
     * Generate unique account number.
     */
    const accountNumber =
      await this.generateUniqueAccountNumber();

    /*
     * Create account.
     */
    try {
      const account =
        await this.prisma.client.orm.public.WalletAccount.create({
          walletId: wallet.id,

          accountNumber,

          accountName:
            `${user.firstName} ${user.lastName}`.trim(),

          bankName:
            'Zarova Virtual Bank',

          bankCode:
            'ZAROVA',

          accountType:
            'VIRTUAL',

          status:
            'ACTIVE',
          updatedAt:
            nowInstant(),
        });

      console.log(
        `Wallet account created automatically for wallet ${wallet.id}`,
      );

      return account;
    } catch (error: any) {
      /*
       * Another request may have created
       * the account at the same time.
       *
       * Re-check before failing.
       */
      const account =
        await this.prisma.client.orm.public.WalletAccount.first({
          walletId: wallet.id,
        });

      if (account) {
        return account;
      }

      console.error(
        'ENSURE WALLET ACCOUNT ERROR:',
        error,
      );

      throw error;
    }
  }

  /*
   * ==========================================
   * FIND TRANSFER RECIPIENT
   *
   * Resolve a Zarova wallet using its virtual
   * account number.
   *
   * This supports user-to-user transfers without
   * exposing wallet IDs in the UI.
   * ==========================================
   */
  async findTransferRecipient(
    userId: number,
    accountNumber: string,
  ) {
    const normalizedAccountNumber =
      String(accountNumber ?? '').trim();

    if (
      !/^\d{10}$/.test(
        normalizedAccountNumber,
      )
    ) {
      throw new BadRequestException(
        'Enter a valid 10-digit recipient account number',
      );
    }

    const account =
      await this.prisma.client.orm.public.WalletAccount.first({
        accountNumber:
          normalizedAccountNumber,
      });

    if (!account) {
      throw new NotFoundException(
        'Recipient account not found',
      );
    }

    if (account.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Recipient account is not active',
      );
    }

    const destinationWallet =
      await this.prisma.client.orm.public.Wallet.first({
        id: account.walletId,
      });

    if (!destinationWallet) {
      throw new NotFoundException(
        'Recipient wallet not found',
      );
    }

    if (destinationWallet.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Recipient wallet is not active',
      );
    }

    if (destinationWallet.userId === userId) {
      throw new BadRequestException(
        'You cannot transfer money to your own wallet',
      );
    }

    return this.serialize({
      walletId: destinationWallet.id,
      userId: destinationWallet.userId,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      bankName: account.bankName,
      currency: destinationWallet.currency,
      status: destinationWallet.status,
    });
  }

  /*
   * ==========================================
   * CREATE WALLET
   *
   * POST /wallets
   * ==========================================
   */
  async create(
    userId: number,
    createWalletDto: CreateWalletDto,
  ) {
    try {
      const currency =
        createWalletDto.currency as WalletCurrency;

      /*
       * Verify user exists.
       */
      const user =
        await this.getWalletOwner(userId);

      /*
       * Check whether user already has
       * wallet in this currency.
       */
      const existingWallet =
        await this.prisma.client.orm.public.Wallet.first({
          userId,
          currency,
        });

      if (existingWallet) {
        /*
         * Ensure even an old wallet
         * has an account.
         */
        const account =
          await this.ensureWalletAccount(
            existingWallet,
          );

        throw new ConflictException(
          `You already have a ${currency} wallet`,
        );
      }

      /*
       * Create wallet.
       */
      const wallet =
        await this.prisma.client.orm.public.Wallet.create({
          userId,
          currency,
          balance: 0n,
          status: 'ACTIVE',
          updatedAt: nowInstant(),
        });

      /*
       * Automatically create wallet account.
       */
      const account =
        await this.ensureWalletAccount(
          wallet,
        );

      return this.serialize({
        ...wallet,
        account,
        owner: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    } catch (error) {
      console.error(
        'CREATE WALLET ERROR:',
        error,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Unable to create wallet',
      );
    }
  }

  /*
   * ==========================================
   * GET AUTHENTICATED USER WALLETS
   *
   * GET /wallets
   *
   * IMPORTANT:
   *
   * Existing wallets without accounts will
   * automatically receive accounts here.
   *
   * ==========================================
   */
  async findMyWallets(
    userId: number,
  ) {
    try {
      console.log(
        '==========================================',
      );

      console.log(
        'FETCHING WALLETS FOR USER:',
        userId,
      );

      console.log(
        '==========================================',
      );

      /*
       * Retrieve user wallets.
       */
      const wallets =
        await this.prisma.client.orm.public.Wallet
          .where({
            userId,
          })
          .all();

      console.log(
        'WALLETS FOUND:',
        wallets.length,
      );

      /*
       * Ensure every wallet has an account.
       *
       * This automatically repairs
       * historical wallets.
       */
      const walletsWithAccounts =
        await Promise.all(
          wallets.map(async (wallet) => {
            const account =
              await this.ensureWalletAccount(
                wallet,
              );

            return {
              ...wallet,
              account,
            };
          }),
        );

      console.log(
        'WALLET ACCOUNTS VERIFIED:',
        walletsWithAccounts.length,
      );

      return this.serialize(
        walletsWithAccounts,
      );
    } catch (error) {
      console.error(
        'FIND MY WALLETS ERROR:',
        error,
      );

      throw new InternalServerErrorException(
        'Unable to retrieve wallets',
      );
    }
  }

  /*
   * ==========================================
   * GET SINGLE WALLET
   *
   * GET /wallets/:id
   * ==========================================
   */
  async findOne(
    userId: number,
    walletId: number,
  ) {
    try {
      const wallet =
        await this.prisma.client.orm.public.Wallet.first({
          id: walletId,
          userId,
        });

      if (!wallet) {
        throw new NotFoundException(
          'Wallet not found',
        );
      }

      /*
       * Automatically ensure account exists.
       */
      const account =
        await this.ensureWalletAccount(
          wallet,
        );

      return this.serialize({
        ...wallet,
        account,
      });
    } catch (error) {
      console.error(
        'FIND WALLET ERROR:',
        error,
      );

      if (
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Unable to retrieve wallet',
      );
    }
  }

  /*
   * ==========================================
   * GET WALLET ACCOUNT
   *
   * GET /wallets/:id/account
   *
   * Missing accounts are automatically created.
   *
   * ==========================================
   */
  async getWalletAccount(
    userId: number,
    walletId: number,
  ) {
    try {
      /*
       * Verify ownership.
       */
      const wallet =
        await this.prisma.client.orm.public.Wallet.first({
          id: walletId,
          userId,
        });

      if (!wallet) {
        throw new NotFoundException(
          'Wallet not found',
        );
      }

      /*
       * Ensure account exists.
       */
      const account =
        await this.ensureWalletAccount(
          wallet,
        );

      return this.serialize({
        walletId:
          wallet.id,

        currency:
          wallet.currency,

        accountNumber:
          account.accountNumber,

        accountName:
          account.accountName,

        bankName:
          account.bankName,

        bankCode:
          account.bankCode,

        accountType:
          account.accountType,

        status:
          account.status,

        createdAt:
          account.createdAt,
      });
    } catch (error) {
      console.error(
        'GET WALLET ACCOUNT ERROR:',
        error,
      );

      if (
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Unable to retrieve wallet account',
      );
    }
  }

  /*
   * ==========================================
   * DEPOSIT MONEY
   *
   * POST /wallets/:id/deposit
   * ==========================================
   */
  async deposit(
    userId: number,
    walletId: number,
    depositDto: DepositDto,
  ) {
    try {
      const amount = this.parseAmount(
        depositDto.amount,
        'Deposit amount',
      );

      const result =
        await this.prisma.client.transaction(
          async (tx: any) => {
            const wallet =
              await tx.orm.public.Wallet.first({
                id: walletId,
              });

            if (!wallet) {
              throw new NotFoundException(
                'Wallet not found',
              );
            }

            if (wallet.userId !== userId) {
              throw new NotFoundException(
                'Wallet not found',
              );
            }

            if (wallet.status !== 'ACTIVE') {
              throw new BadRequestException(
                'Wallet is not active',
              );
            }

            if (
              wallet.balance >
              WalletsService.MAX_BIGINT - amount
            ) {
              throw new BadRequestException(
                'Deposit would exceed the maximum wallet balance',
              );
            }

            const newBalance =
              wallet.balance + amount;

            /*
             * IMPORTANT:
             * The transaction record is created before
             * LedgerEntry records because LedgerEntry
             * has a foreign key to Transaction.
             */
            const transaction =
              await tx.orm.public.Transaction.create({
                reference:
                  this.generateReference('DEP'),
                _type: 'DEPOSIT',
                amount,
                currency: wallet.currency,
                status: 'COMPLETED',
                updatedAt: nowInstant(),
                sourceWalletId: null,
                destinationWalletId:
                  wallet.id,
              });

            await this.ledgerService.postDeposit(
              tx,
              transaction.id,
              amount,
              wallet.currency as WalletCurrency,
            );

            const updatedWallet =
              await tx.orm.public.Wallet
                .where({
                  id: wallet.id,
                })
                .update({
                  balance: newBalance,
                });

            return {
              transaction,
              wallet: updatedWallet,
            };
          },
        );

      return this.serialize({
        message:
          'Deposit completed successfully',
        transaction:
          result.transaction,
        wallet:
          result.wallet,
      });
    } catch (error) {
      console.error(
        'DEPOSIT ERROR:',
        error,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Unable to complete deposit',
      );
    }
  }

  /*
   * ==========================================
   * WITHDRAW MONEY
   *
   * POST /wallets/:id/withdraw
   * ==========================================
   */
  async withdraw(
    userId: number,
    walletId: number,
    withdrawDto: WithdrawDto,
  ) {
    try {
      const amount = this.parseAmount(
        withdrawDto.amount,
        'Withdrawal amount',
      );

      const result =
        await this.prisma.client.transaction(
          async (tx: any) => {
            // IMPORTANT: scope the wallet lookup to the authenticated user.
            // This prevents an authenticated user from operating on another
            // user's wallet even when they know the wallet ID.
            const wallet =
              await tx.orm.public.Wallet.first({
                id: walletId,
                userId,
              });

            if (!wallet) {
              throw new NotFoundException(
                'Wallet not found',
              );
            }

            if (wallet.userId !== userId) {
              throw new NotFoundException(
                'Wallet not found',
              );
            }

            if (wallet.status !== 'ACTIVE') {
              throw new BadRequestException(
                'Wallet is not active',
              );
            }

            if (wallet.balance < amount) {
              throw new BadRequestException(
                'Insufficient wallet balance',
              );
            }

            const newBalance =
              wallet.balance - amount;

            /*
             * Create Transaction first, then LedgerEntry,
             * then update the wallet, all inside one DB
             * transaction.
             */
            const transaction =
              await tx.orm.public.Transaction.create({
                reference:
                  this.generateReference('WDR'),
                _type: 'WITHDRAWAL',
                amount,
                currency: wallet.currency,
                status: 'COMPLETED',
                updatedAt: nowInstant(),
                sourceWalletId:
                  wallet.id,
                destinationWalletId: null,
              });

            await this.ledgerService.postWithdrawal(
              tx,
              transaction.id,
              amount,
              wallet.currency as WalletCurrency,
            );

            const updatedWallet =
              await tx.orm.public.Wallet
                .where({
                  id: wallet.id,
                  userId,
                })
                .update({
                  balance: newBalance,
                  updatedAt: nowInstant(),
                });

            return {
              transaction,
              wallet: updatedWallet,
            };
          },
        );

      return this.serialize({
        message:
          'Withdrawal completed successfully',
        transaction:
          result.transaction,
        wallet:
          result.wallet,
      });
    } catch (error) {
      console.error(
        'WITHDRAW ERROR:',
        error,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Unable to complete withdrawal',
      );
    }
  }

  /*
   * ==========================================
   * TRANSFER MONEY
   *
   * POST /wallets/:id/transfer
   * ==========================================
   */
  async transfer(
    userId: number,
    sourceWalletId: number,
    transferDto: TransferDto,
  ) {
    try {
      const amount = this.parseAmount(
        transferDto.amount,
        'Transfer amount',
      );

      const destinationWalletId = Number(
        transferDto.destinationWalletId,
      );

      if (
        !Number.isSafeInteger(
          destinationWalletId,
        ) ||
        destinationWalletId <= 0
      ) {
        throw new BadRequestException(
          'Destination wallet is invalid',
        );
      }

      const result =
        await this.prisma.client.transaction(
          async (tx: any) => {
            const sourceWallet =
              await tx.orm.public.Wallet.first({
                id: sourceWalletId,
              });

            if (!sourceWallet) {
              throw new NotFoundException(
                'Source wallet not found',
              );
            }

            if (
              sourceWallet.userId !== userId
            ) {
              throw new NotFoundException(
                'Source wallet not found',
              );
            }

            if (
              sourceWallet.status !== 'ACTIVE'
            ) {
              throw new BadRequestException(
                'Source wallet is not active',
              );
            }

            const destinationWallet =
              await tx.orm.public.Wallet.first({
                id: destinationWalletId,
              });

            if (!destinationWallet) {
              throw new NotFoundException(
                'Destination wallet not found',
              );
            }

            if (
              destinationWallet.status !==
              'ACTIVE'
            ) {
              throw new BadRequestException(
                'Destination wallet is not active',
              );
            }

            if (
              sourceWallet.id ===
              destinationWallet.id
            ) {
              throw new BadRequestException(
                'Cannot transfer to the same wallet',
              );
            }

            if (
              sourceWallet.currency !==
              destinationWallet.currency
            ) {
              throw new BadRequestException(
                'Wallet currencies do not match',
              );
            }

            if (
              sourceWallet.balance <
              amount
            ) {
              throw new BadRequestException(
                'Insufficient wallet balance',
              );
            }

            if (
              destinationWallet.balance >
              WalletsService.MAX_BIGINT -
                amount
            ) {
              throw new BadRequestException(
                'Transfer would exceed the maximum destination wallet balance',
              );
            }

            const sourceNewBalance =
              sourceWallet.balance -
              amount;

            const destinationNewBalance =
              destinationWallet.balance +
              amount;

            /*
             * Create the Transaction before LedgerEntry.
             * Everything below executes inside the same
             * database transaction.
             */
            const transaction =
              await tx.orm.public.Transaction.create({
                reference:
                  this.generateReference('TRF'),
                _type: 'TRANSFER',
                amount,
                currency:
                  sourceWallet.currency,
                status: 'COMPLETED',
                updatedAt: nowInstant(),
                sourceWalletId:
                  sourceWallet.id,
                destinationWalletId:
                  destinationWallet.id,
              });

            await this.ledgerService.postTransfer(
              tx,
              transaction.id,
              amount,
              sourceWallet.currency as WalletCurrency,
            );

            const updatedSourceWallet =
              await tx.orm.public.Wallet
                .where({
                  id: sourceWallet.id,
                })
                .update({
                  balance:
                    sourceNewBalance,
                });

            const updatedDestinationWallet =
              await tx.orm.public.Wallet
                .where({
                  id:
                    destinationWallet.id,
                })
                .update({
                  balance:
                    destinationNewBalance,
                });

            return {
              transaction,
              sourceWallet:
                updatedSourceWallet,
              destinationWallet:
                updatedDestinationWallet,
            };
          },
        );

      return this.serialize({
        message:
          'Transfer completed successfully',
        transaction:
          result.transaction,
        sourceWallet:
          result.sourceWallet,
        destinationWallet:
          result.destinationWallet,
      });
    } catch (error) {
      console.error(
        'TRANSFER ERROR:',
        error,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Unable to complete transfer',
      );
    }
  }
}
