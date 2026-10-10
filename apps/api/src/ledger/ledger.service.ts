import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

type Currency = 'NGN' | 'USD' | 'EUR' | 'GBP';

type AccountType =
  | 'ASSET'
  | 'LIABILITY'
  | 'REVENUE'
  | 'EXPENSE'
  | 'EQUITY';

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /* ==========================================================
     GLOBAL CHART OF ACCOUNTS
     ========================================================== */

  async getOrCreateAccount(
    tx: any,
    code: string,
    name: string,
    _type: AccountType,
    currency: Currency,
  ) {
    const existingAccount =
      await tx.orm.public.LedgerAccount.first({
        code,
      });

    if (existingAccount) {
      return existingAccount;
    }

    return tx.orm.public.LedgerAccount.create({
      code,
      name,
      _type,
      currency,
      active: true,
    });
  }

  async getCashAccount(
    tx: any,
    currency: Currency,
  ) {
    return this.getOrCreateAccount(
      tx,
      `CASH-${currency}`,
      `Cash / Settlement Account (${currency})`,
      'ASSET',
      currency,
    );
  }

  async getWalletLiabilityAccount(
    tx: any,
    currency: Currency,
  ) {
    return this.getOrCreateAccount(
      tx,
      `WALLET-${currency}`,
      `Customer Wallet Liability (${currency})`,
      'LIABILITY',
      currency,
    );
  }

  /* ==========================================================
     INITIALIZE GLOBAL LEDGER ACCOUNTS

     These accounts belong to the platform, not to an
     individual customer.
     ========================================================== */

  async ensureLedgerAccounts() {
    const wallets =
      await this.prisma.client.orm.public.Wallet.all();

    const currencies = [
      ...new Set(
        wallets.map(
          (wallet: any) =>
            wallet.currency as Currency,
        ),
      ),
    ];

    if (currencies.length === 0) {
      return;
    }

    await this.prisma.client.transaction(
      async (tx: any) => {
        for (const currency of currencies) {
          await this.getCashAccount(
            tx,
            currency,
          );

          await this.getWalletLiabilityAccount(
            tx,
            currency,
          );
        }
      },
    );
  }

  /* ==========================================================
     DOUBLE-ENTRY VALIDATION
     ========================================================== */

  validateEntries(
    entries: Array<{
      accountId: number;
      debit: bigint;
      credit: bigint;
    }>,
  ) {
    if (entries.length < 2) {
      throw new BadRequestException(
        'A ledger transaction requires at least two entries',
      );
    }

    let totalDebit = 0n;
    let totalCredit = 0n;

    for (const entry of entries) {
      if (
        entry.debit < 0n ||
        entry.credit < 0n
      ) {
        throw new BadRequestException(
          'Ledger amounts cannot be negative',
        );
      }

      if (
        entry.debit > 0n &&
        entry.credit > 0n
      ) {
        throw new BadRequestException(
          'A ledger entry cannot contain both debit and credit amounts',
        );
      }

      if (
        entry.debit === 0n &&
        entry.credit === 0n
      ) {
        throw new BadRequestException(
          'A ledger entry must contain a debit or credit amount',
        );
      }

      totalDebit += entry.debit;
      totalCredit += entry.credit;
    }

    if (totalDebit !== totalCredit) {
      throw new BadRequestException(
        'Ledger transaction is not balanced',
      );
    }

    return {
      totalDebit,
      totalCredit,
    };
  }

  /* ==========================================================
     CREATE DOUBLE ENTRY
     ========================================================== */

  async createDoubleEntry(
    tx: any,
    transactionId: number,
    entries: Array<{
      accountId: number;
      debit: bigint;
      credit: bigint;
    }>,
  ) {
    this.validateEntries(entries);

    const createdEntries = [];

    for (const entry of entries) {
      const createdEntry =
        await tx.orm.public.LedgerEntry.create({
          transactionId,
          accountId: entry.accountId,
          debit: entry.debit,
          credit: entry.credit,
        });

      createdEntries.push(createdEntry);
    }

    return createdEntries;
  }

  /* ==========================================================
     POST DEPOSIT
     Debit: Cash
     Credit: Wallet Liability
     ========================================================== */

  async postDeposit(
    tx: any,
    transactionId: number,
    amount: bigint,
    currency: Currency,
  ) {
    const cashAccount =
      await this.getCashAccount(
        tx,
        currency,
      );

    const walletAccount =
      await this.getWalletLiabilityAccount(
        tx,
        currency,
      );

    return this.createDoubleEntry(
      tx,
      transactionId,
      [
        {
          accountId: cashAccount.id,
          debit: amount,
          credit: 0n,
        },
        {
          accountId: walletAccount.id,
          debit: 0n,
          credit: amount,
        },
      ],
    );
  }

  /* ==========================================================
     POST WITHDRAWAL
     Debit: Wallet Liability
     Credit: Cash
     ========================================================== */

  async postWithdrawal(
    tx: any,
    transactionId: number,
    amount: bigint,
    currency: Currency,
  ) {
    const cashAccount =
      await this.getCashAccount(
        tx,
        currency,
      );

    const walletAccount =
      await this.getWalletLiabilityAccount(
        tx,
        currency,
      );

    return this.createDoubleEntry(
      tx,
      transactionId,
      [
        {
          accountId: walletAccount.id,
          debit: amount,
          credit: 0n,
        },
        {
          accountId: cashAccount.id,
          debit: 0n,
          credit: amount,
        },
      ],
    );
  }

  /* ==========================================================
     POST TRANSFER

     Internal wallet transfer.
     ========================================================== */

  async postTransfer(
    tx: any,
    transactionId: number,
    amount: bigint,
    currency: Currency,
  ) {
    const walletAccount =
      await this.getWalletLiabilityAccount(
        tx,
        currency,
      );

    return this.createDoubleEntry(
      tx,
      transactionId,
      [
        {
          accountId: walletAccount.id,
          debit: amount,
          credit: 0n,
        },
        {
          accountId: walletAccount.id,
          debit: 0n,
          credit: amount,
        },
      ],
    );
  }

  /* ==========================================================
     POST ADMIN WALLET PAYMENT

     Debit: Source Wallet Liability
     Credit: Destination Wallet Liability
     ========================================================== */

  async postWalletPayment(
    tx: any,
    transactionId: number,
    sourceWalletId: number,
    destinationWalletId: number,
    amount: bigint,
    currency: Currency,
  ) {
    if (
      !Number.isSafeInteger(sourceWalletId) ||
      sourceWalletId <= 0 ||
      !Number.isSafeInteger(destinationWalletId) ||
      destinationWalletId <= 0 ||
      sourceWalletId === destinationWalletId
    ) {
      throw new BadRequestException('Invalid payment wallet IDs');
    }

    if (amount <= 0n) {
      throw new BadRequestException('Ledger payment amount must be positive');
    }

    const sourceAccount = await this.getOrCreateAccount(
      tx,
      `WALLET-${sourceWalletId}-${currency}`,
      `Wallet ${sourceWalletId} Liability (${currency})`,
      'LIABILITY',
      currency,
    );

    const destinationAccount = await this.getOrCreateAccount(
      tx,
      `WALLET-${destinationWalletId}-${currency}`,
      `Wallet ${destinationWalletId} Liability (${currency})`,
      'LIABILITY',
      currency,
    );

    return this.createDoubleEntry(tx, transactionId, [
      { accountId: sourceAccount.id, debit: amount, credit: 0n },
      { accountId: destinationAccount.id, debit: 0n, credit: amount },
    ]);
  }

  /* ==========================================================
     REVERSE LEDGER TRANSACTION
     ========================================================== */

  async reverseTransactionInTx(
    tx: any,
    originalTransactionId: number,
    reversalTransactionId: number,
  ) {
    if (
      !Number.isSafeInteger(
        originalTransactionId,
      ) ||
      originalTransactionId <= 0
    ) {
      throw new BadRequestException(
        'Original transaction ID is invalid',
      );
    }

    if (
      !Number.isSafeInteger(
        reversalTransactionId,
      ) ||
      reversalTransactionId <= 0
    ) {
      throw new BadRequestException(
        'Reversal transaction ID is invalid',
      );
    }

    const originalEntries =
      await tx.orm.public.LedgerEntry.where({
        transactionId:
          originalTransactionId,
      }).all();

    if (!originalEntries.length) {
      throw new BadRequestException(
        'No ledger entries found for transaction',
      );
    }

    const existingReversalEntries =
      await tx.orm.public.LedgerEntry.where({
        transactionId:
          reversalTransactionId,
      }).all();

    if (
      existingReversalEntries.length > 0
    ) {
      throw new BadRequestException(
        'Ledger entries already exist for reversal transaction',
      );
    }

    const reversalEntries =
      originalEntries.map(
        (entry: any) => ({
          accountId: entry.accountId,
          debit: BigInt(
            entry.credit ?? 0,
          ),
          credit: BigInt(
            entry.debit ?? 0,
          ),
        }),
      );

    this.validateEntries(
      reversalEntries,
    );

    return this.createDoubleEntry(
      tx,
      reversalTransactionId,
      reversalEntries,
    );
  }

  async reverseTransaction(
    originalTransactionId: number,
    reversalTransactionId: number,
  ) {
    return this.prisma.client.transaction(
      async (tx: any) =>
        this.reverseTransactionInTx(
          tx,
          originalTransactionId,
          reversalTransactionId,
        ),
    );
  }

  /* ==========================================================
     GLOBAL ADMIN LEDGER

     This method remains global and should be used by an
     administrator-facing ledger endpoint.
     ========================================================== */

  async getAllAccounts() {
    await this.ensureLedgerAccounts();

    const accounts =
      await this.prisma.client.orm.public.LedgerAccount.all();

    return Promise.all(
      accounts.map(
        async (account: any) => {
          const entries =
            await this.prisma.client.orm.public.LedgerEntry.where(
              {
                accountId:
                  account.id,
              },
            ).all();

          let totalDebit = 0n;
          let totalCredit = 0n;

          for (const entry of entries) {
            totalDebit += entry.debit;
            totalCredit += entry.credit;
          }

          const balance =
            account._type === 'ASSET' ||
            account._type === 'EXPENSE'
              ? totalDebit -
                totalCredit
              : totalCredit -
                totalDebit;

          return {
            id: account.id,
            code: account.code,
            name: account.name,
            type: account._type,
            currency: account.currency,
            active: account.active,
            createdAt: account.createdAt,
            updatedAt: account.updatedAt,
            totalDebit: totalDebit.toString(),
            totalCredit: totalCredit.toString(),
            balance: balance.toString(),
          };
        },
      ),
    );
  }

  /* ==========================================================
     USER LEDGER SUPPORT

     IMPORTANT:
     LedgerAccount is global. We must therefore scope a
     customer's ledger through the customer's wallets and
     transactions.

     We NEVER return the global LedgerAccount balances to a
     normal user.
     ========================================================== */

  private async getUserWalletIds(
    userId: number,
  ): Promise<number[]> {
    const wallets =
      await this.prisma.client.orm.public.Wallet.where({
        userId,
      }).all();

    return wallets.map(
      (wallet: any) => wallet.id,
    );
  }

  private async getUserTransactionIds(
    userId: number,
  ): Promise<number[]> {
    const walletIds =
      await this.getUserWalletIds(
        userId,
      );

    if (walletIds.length === 0) {
      return [];
    }

    const transactionIds =
      new Set<number>();

    /*
     * Deposits and inbound transfers.
     */
    for (const walletId of walletIds) {
      const incoming =
        await this.prisma.client.orm.public.Transaction.where(
          {
            destinationWalletId:
              walletId,
          },
        ).all();

      for (const transaction of incoming) {
        transactionIds.add(
          transaction.id,
        );
      }
    }

    /*
     * Withdrawals and outbound transfers.
     */
    for (const walletId of walletIds) {
      const outgoing =
        await this.prisma.client.orm.public.Transaction.where(
          {
            sourceWalletId:
              walletId,
          },
        ).all();

      for (const transaction of outgoing) {
        transactionIds.add(
          transaction.id,
        );
      }
    }

    return [...transactionIds];
  }

  private async getUserLedgerEntries(
    userId: number,
  ) {
    const transactionIds =
      await this.getUserTransactionIds(
        userId,
      );

    if (transactionIds.length === 0) {
      return [];
    }

    const entries = [];

    for (const transactionId of transactionIds) {
      const transactionEntries =
        await this.prisma.client.orm.public.LedgerEntry.where(
          {
            transactionId,
          },
        ).all();

      entries.push(
        ...transactionEntries,
      );
    }

    return entries;
  }

  /* ==========================================================
     USER LEDGER ACCOUNTS

     GET /ledger/accounts

     This is the endpoint used by the normal user application.
     It returns only accounts represented in the authenticated
     user's own ledger transactions.
     ========================================================== */

  async getUserAccounts(
    userId: number,
  ) {
    if (
      !Number.isSafeInteger(userId) ||
      userId <= 0
    ) {
      throw new ForbiddenException(
        'Invalid authenticated user',
      );
    }

    const entries =
      await this.getUserLedgerEntries(
        userId,
      );

    /*
     * A brand-new user with no transactions must see an empty
     * ledger, not another customer's historical balances.
     */
    if (entries.length === 0) {
      return [];
    }

    const accountIds = [
      ...new Set(
        entries.map(
          (entry: any) =>
            entry.accountId,
        ),
      ),
    ];

    const accounts = [];

    for (const accountId of accountIds) {
      const account =
        await this.prisma.client.orm.public.LedgerAccount.first(
          {
            id: accountId,
          },
        );

      if (!account) {
        continue;
      }

      let totalDebit = 0n;
      let totalCredit = 0n;

      for (const entry of entries) {
        if (
          entry.accountId !==
          accountId
        ) {
          continue;
        }

        totalDebit += entry.debit;
        totalCredit += entry.credit;
      }

      const balance =
        account._type === 'ASSET' ||
        account._type === 'EXPENSE'
          ? totalDebit -
            totalCredit
          : totalCredit -
            totalDebit;

      accounts.push({
        id: account.id,
        code: account.code,
        name: account.name,
        type: account._type,
        currency: account.currency,
        active: account.active,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        totalDebit: totalDebit.toString(),
        totalCredit: totalCredit.toString(),
        balance: balance.toString(),
      });
    }

    return accounts;
  }

  /* ==========================================================
     USER TRANSACTION LEDGER ENTRIES

     Only allow a user to inspect transactions involving one
     of that user's own wallets.
     ========================================================== */

  async getUserTransactionEntries(
    transactionId: number,
    userId: number,
  ) {
    if (
      !Number.isSafeInteger(
        transactionId,
      ) ||
      transactionId <= 0
    ) {
      throw new BadRequestException(
        'Transaction ID is invalid',
      );
    }

    const walletIds =
      await this.getUserWalletIds(
        userId,
      );

    if (walletIds.length === 0) {
      throw new NotFoundException(
        'Transaction not found',
      );
    }

    const transaction =
      await this.prisma.client.orm.public.Transaction.first(
        {
          id: transactionId,
        },
      );

    if (!transaction) {
      throw new NotFoundException(
        'Transaction not found',
      );
    }

    const belongsToUser =
      walletIds.includes(
        transaction.sourceWalletId ??
          -1,
      ) ||
      walletIds.includes(
        transaction.destinationWalletId ??
          -1,
      );

    if (!belongsToUser) {
      throw new NotFoundException(
        'Transaction not found',
      );
    }

    const entries =
      await this.prisma.client.orm.public.LedgerEntry.where(
        {
          transactionId,
        },
      ).all();

    return entries.map(
      (entry: any) => ({
        ...entry,
        debit:
          entry.debit.toString(),
        credit:
          entry.credit.toString(),
      }),
    );
  }

  /* ==========================================================
     USER ACCOUNT BALANCE

     Calculate the balance using only this user's own ledger
     entries, never the global ledger total.
     ========================================================== */

  async getUserAccountBalance(
    accountId: number,
    userId: number,
  ) {
    if (
      !Number.isSafeInteger(
        accountId,
      ) ||
      accountId <= 0
    ) {
      throw new BadRequestException(
        'Ledger account ID is invalid',
      );
    }

    const account =
      await this.prisma.client.orm.public.LedgerAccount.first(
        {
          id: accountId,
        },
      );

    if (!account) {
      throw new NotFoundException(
        'Ledger account not found',
      );
    }

    const entries =
      await this.getUserLedgerEntries(
        userId,
      );

    const accountEntries =
      entries.filter(
        (entry: any) =>
          entry.accountId ===
          accountId,
      );

    /*
     * The account may exist globally but not belong to the
     * authenticated user's ledger activity.
     */
    if (accountEntries.length === 0) {
      throw new NotFoundException(
        'Ledger account not found',
      );
    }

    let totalDebit = 0n;
    let totalCredit = 0n;

    for (const entry of accountEntries) {
      totalDebit += entry.debit;
      totalCredit += entry.credit;
    }

    const balance =
      account._type === 'ASSET' ||
      account._type === 'EXPENSE'
        ? totalDebit -
          totalCredit
        : totalCredit -
          totalDebit;

    return {
      account,
      totalDebit:
        totalDebit.toString(),
      totalCredit:
        totalCredit.toString(),
      balance:
        balance.toString(),
    };
  }

  /* ==========================================================
     BACKWARD-COMPATIBLE GLOBAL METHODS

     Keep these available for existing internal/admin callers.
     Normal user controller routes must use the user-scoped
     methods above.
     ========================================================== */

  async getTransactionEntries(
    transactionId: number,
  ) {
    const entries =
      await this.prisma.client.orm.public.LedgerEntry.where(
        {
          transactionId,
        },
      ).all();

    return entries.map(
      (entry: any) => ({
        ...entry,
        debit:
          entry.debit.toString(),
        credit:
          entry.credit.toString(),
      }),
    );
  }

  async getAccountBalance(
    accountId: number,
  ) {
    const account =
      await this.prisma.client.orm.public.LedgerAccount.first(
        {
          id: accountId,
        },
      );

    if (!account) {
      throw new BadRequestException(
        'Ledger account not found',
      );
    }

    const entries =
      await this.prisma.client.orm.public.LedgerEntry.where(
        {
          accountId,
        },
      ).all();

    let totalDebit = 0n;
    let totalCredit = 0n;

    for (const entry of entries) {
      totalDebit += entry.debit;
      totalCredit += entry.credit;
    }

    const balance =
      account._type === 'ASSET' ||
      account._type === 'EXPENSE'
        ? totalDebit -
          totalCredit
        : totalCredit -
          totalDebit;

    return {
      account,
      totalDebit:
        totalDebit.toString(),
      totalCredit:
        totalCredit.toString(),
      balance:
        balance.toString(),
    };
  }
}
