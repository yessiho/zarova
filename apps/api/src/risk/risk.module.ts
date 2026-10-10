import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

import { RiskController } from './risk.controller.js';
import { RiskService } from './risk.service.js';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [RiskController],
  providers: [RiskService],
  exports: [RiskService],
})
export class RiskModule {}
