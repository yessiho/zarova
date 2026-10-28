import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { nowInstant } from '../prisma/temporal.js';

const DEMO_PASSWORD = 'Demo@1234';

const DEMO_USERS = [
  { email: 'amara.okafor@demo.zarova.com', firstName: 'Amara', lastName: 'Okafor' },
  { email: 'chidi.nwankwo@demo.zarova.com', firstName: 'Chidi', lastName: 'Nwankwo' },
  { email: 'fatima.bello@demo.zarova.com', firstName: 'Fatima', lastName: 'Bello' },
  { email: 'emeka.eze@demo.zarova.com', firstName: 'Emeka', lastName: 'Eze' },
  { email: 'ngozi.adeyemi@demo.zarova.com', firstName: 'Ngozi', lastName: 'Adeyemi' },
];

// Amounts in kobo (NGN cents — 1 NGN = 100 kobo)
const KOBO = 100n;
const NGN = (naira: number) => BigInt(naira) * KOBO;

@Injectable()
export class DemoSeedService implements OnModuleInit {
  private readonly logger = new Logger(DemoSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedIfEmpty();
  }

  private async seedIfEmpty() {
    const existingUser =
      await this.prisma.client.orm.public.User.first({
        email: DEMO_USERS[0].email,
      });

    if (existingUser) {
      return;
    }

    this.logger.log('Seeding demo data...');

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

    // ── Create users ──────────────────────────────────────────────
    const users: { id: number; firstName: string; email: string }[] = [];

    for (const u of DEMO_USERS) {
      const user = await this.prisma.client.orm.public.User.create({
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        passwordHash,
        updatedAt: nowInstant(),
      });
      users.push({ id: user.id, firstName: user.firstName, email: user.email });
    }

    // ── Create NGN wallets for each user ──────────────────────────
    const wallets: { id: number; userId: number }[] = [];

    for (const u of users) {
      const wallet = await this.prisma.client.orm.public.Wallet.create({
        userId: u.id,
        currency: 'NGN',
        updatedAt: nowInstant(),
      });
      wallets.push({ id: wallet.id, userId: u.id });
    }

    // ── Seed transactions and update balances ─────────────────────
    const deposits: { walletId: number; amount: bigint }[] = [
      { walletId: wallets[0].id, amount: NGN(250_000) },
      { walletId: wallets[1].id, amount: NGN(180_000) },
      { walletId: wallets[2].id, amount: NGN(320_000) },
      { walletId: wallets[3].id, amount: NGN(95_000) },
      { walletId: wallets[4].id, amount: NGN(500_000) },
    ];

    let refCounter = 1;
    const ref = () => `DEMO-TXN-${String(refCounter++).padStart(6, '0')}`;

    // Deposits
    for (const d of deposits) {
      await this.prisma.client.orm.public.Transaction.create({
        amount: d.amount,
        currency: 'NGN',
        reference: ref(),
        destinationWalletId: d.walletId,
        status: 'COMPLETED',
        _type: 'DEPOSIT',
        updatedAt: nowInstant(),
      });

      await this.prisma.client.orm.public.Wallet
        .where({ id: d.walletId })
        .update({ balance: d.amount, updatedAt: nowInstant() });
    }

    // Transfers between users
    const transfers: { from: number; to: number; amount: bigint }[] = [
      { from: wallets[2].id, to: wallets[0].id, amount: NGN(50_000) },
      { from: wallets[4].id, to: wallets[1].id, amount: NGN(75_000) },
      { from: wallets[0].id, to: wallets[3].id, amount: NGN(25_000) },
      { from: wallets[1].id, to: wallets[4].id, amount: NGN(30_000) },
    ];

    for (const t of transfers) {
      await this.prisma.client.orm.public.Transaction.create({
        amount: t.amount,
        currency: 'NGN',
        reference: ref(),
        sourceWalletId: t.from,
        destinationWalletId: t.to,
        status: 'COMPLETED',
        _type: 'TRANSFER',
        updatedAt: nowInstant(),
      });

      // Debit source wallet
      const src = await this.prisma.client.orm.public.Wallet.first({ id: t.from });
      if (src) {
        await this.prisma.client.orm.public.Wallet
          .where({ id: t.from })
          .update({ balance: src.balance - t.amount, updatedAt: nowInstant() });
      }

      // Credit destination wallet
      const dst = await this.prisma.client.orm.public.Wallet.first({ id: t.to });
      if (dst) {
        await this.prisma.client.orm.public.Wallet
          .where({ id: t.to })
          .update({ balance: dst.balance + t.amount, updatedAt: nowInstant() });
      }
    }

    // One withdrawal
    const withdrawal = { walletId: wallets[1].id, amount: NGN(20_000) };
    await this.prisma.client.orm.public.Transaction.create({
      amount: withdrawal.amount,
      currency: 'NGN',
      reference: ref(),
      sourceWalletId: withdrawal.walletId,
      status: 'COMPLETED',
      _type: 'WITHDRAWAL',
      updatedAt: nowInstant(),
    });
    const wSrc = await this.prisma.client.orm.public.Wallet.first({ id: withdrawal.walletId });
    if (wSrc) {
      await this.prisma.client.orm.public.Wallet
        .where({ id: withdrawal.walletId })
        .update({ balance: wSrc.balance - withdrawal.amount, updatedAt: nowInstant() });
    }

    this.logger.log(
      `Demo data seeded — ${users.length} users, ${wallets.length} wallets, ${refCounter - 1} transactions.`,
    );
    this.logger.log(`Demo user login: ${DEMO_USERS[0].email} / ${DEMO_PASSWORD}`);
  }
}
