import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

import { AuditController } from './audit.controller.js';
import { AdminAuditController } from './admin-audit.controller.js';
import { AuditService } from './audit.service.js';

@Module({
  imports: [PrismaModule, AuthModule],

  controllers: [AuditController, AdminAuditController],

  providers: [AuditService],

  exports: [AuditService],
})
export class AuditModule {}
