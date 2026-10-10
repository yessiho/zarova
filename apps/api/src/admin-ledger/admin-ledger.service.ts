import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { LedgerService } from '../ledger/ledger.service.js';

@Injectable()
export class AdminLedgerService {
  constructor(
    private readonly ledgerService: LedgerService,
  ) {}

  /* ==========================================================
     GET ALL LEDGER ACCOUNTS

     GET /admin/ledger/accounts

     Prisma internally exposes LedgerAccount.type
     as `_type`.

     The public admin API exposes it as `type`.
     ========================================================== */

  async findAll() {
    const accounts =
      await this.ledgerService.getAllAccounts();

    return accounts.map((account: any) => ({
      id: account.id,
      code: account.code,
      name: account.name,

      // Prisma 8 generated field
      type: account._type,

      currency: account.currency,
      active: account.active,

      totalDebit:
        account.totalDebit?.toString() ?? '0',

      totalCredit:
        account.totalCredit?.toString() ?? '0',

      balance:
        account.balance?.toString() ?? '0',

      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    }));
  }

  /* ==========================================================
     GET SINGLE LEDGER ACCOUNT

     GET /admin/ledger/accounts/:id
     ========================================================== */

  async findOne(accountId: number) {
    const result =
      await this.ledgerService.getAccountBalance(
        accountId,
      );

    if (!result?.account) {
      throw new NotFoundException(
        'Ledger account not found',
      );
    }

    const account = result.account;

    return {
      account: {
        id: account.id,
        code: account.code,
        name: account.name,

        // Prisma 8 generated field
        type: account._type,

        currency: account.currency,
        active: account.active,

        totalDebit:
          result.totalDebit.toString(),

        totalCredit:
          result.totalCredit.toString(),

        balance:
          result.balance.toString(),

        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      },
    };
  }
}