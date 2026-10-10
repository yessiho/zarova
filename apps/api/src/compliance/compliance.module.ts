import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

import { ComplianceController } from './compliance.controller.js';
import { ComplianceService } from './compliance.service.js';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
  ],
  controllers: [
    ComplianceController,
  ],
  providers: [
    ComplianceService,
  ],
  exports: [
    ComplianceService,
  ],
})
export class ComplianceModule {}