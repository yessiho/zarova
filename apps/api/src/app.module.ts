import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AdminsModule } from './admins/admins.module.js';
import { RbacModule } from './rbac/rbac.module.js';

import { AppThrottlerModule } from './throttler/throttler.module.js';
import { EmailModule } from './email/email.module.js';

import { WalletsModule } from './wallets/wallets.module.js';
import { LedgerModule } from './ledger/ledger.module.js';
import { AuditModule } from './audit/audit.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';

import { AdminCustomersModule } from './admin-customers/admin-customers.module.js';
import { AdminAccountsModule } from './admin-accounts/admin-accounts.module.js';
import { AdminTransactionsModule } from './admin-transactions/admin-transactions.module.js';
import { AdminPaymentsModule } from './admin-payments/admin-payments.module.js';
import { AdminLedgerModule } from './admin-ledger/admin-ledger.module.js';
import { ComplianceModule } from './compliance/compliance.module.js';
import { RiskModule } from './risk/risk.module.js';
import { ReconciliationModule } from './reconciliation/reconciliation.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { SystemSettingsModule } from './system-settings/system-settings.module.js';
import { TwoFactorModule } from './two-factor/two-factor.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';
import { PaystackModule } from './paystack/paystack.module.js';
import { KycModule } from './kyc/kyc.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // Global event bus
    EventEmitterModule.forRoot(),

    // Rate limiting (global — enforced by ThrottlerGuard below)
    AppThrottlerModule,

    // Transactional email (global — EmailService injected anywhere)
    EmailModule,

    // Core infrastructure
    PrismaModule,
    AuthModule,

    // Identity & access management
    UsersModule,
    AdminsModule,
    RbacModule,

    // Financial modules
    WalletsModule,
    LedgerModule,
    TransactionsModule,
    AdminCustomersModule,
    AdminAccountsModule,
    AdminTransactionsModule,
    AdminPaymentsModule,
    AdminLedgerModule,
    ComplianceModule,
    RiskModule,
    ReconciliationModule,
    ReportsModule,
    SystemSettingsModule,

    // Audit
    AuditModule,

    // Security
    TwoFactorModule,

    // Notifications
    NotificationsModule,

    // Webhooks
    WebhooksModule,

    // Payment gateway
    PaystackModule,

    // KYC / AML
    KycModule,
  ],

  controllers: [AppController],

  providers: [
    AppService,
    // Apply rate limiting globally to every route
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
