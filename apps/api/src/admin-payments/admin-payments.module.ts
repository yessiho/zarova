import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';

import { RbacModule } from '../rbac/rbac.module.js';

import { AuditModule } from '../audit/audit.module.js';

import { LedgerModule } from '../ledger/ledger.module.js';

import { AdminPaymentsController } from './admin-payments.controller.js';

import { AdminPaymentsService } from './admin-payments.service.js';

@Module({
  imports: [
    PrismaModule,
    RbacModule,
    AuditModule,
    LedgerModule,
  ],

  controllers: [AdminPaymentsController],

  providers: [AdminPaymentsService],

  exports: [AdminPaymentsService],
})
export class AdminPaymentsModule {}