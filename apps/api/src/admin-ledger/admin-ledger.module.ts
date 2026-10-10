import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module.js';
import { AdminLedgerController } from './admin-ledger.controller.js';
import { AdminLedgerService } from './admin-ledger.service.js';

@Module({
  imports: [LedgerModule],
  controllers: [AdminLedgerController],
  providers: [AdminLedgerService],
})
export class AdminLedgerModule {}