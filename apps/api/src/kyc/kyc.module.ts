import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';

import {
  KycAdminController,
  KycUserController,
} from './kyc.controller.js';

import { KycService } from './kyc.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [
    KycUserController,
    KycAdminController,
  ],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule {}
