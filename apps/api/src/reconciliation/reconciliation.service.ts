import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { nowInstant } from '../prisma/temporal.js';

import type { CreateReconciliationRunDto } from './dto/create-reconciliation-run.dto.js';

@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private serialize(value: any): any {
    if (value === null || value === undefined) return value;
    if (typeof value === 'bigint') return value.toString();
    if (value instanceof Date) return value.toISOString();
    if (
      typeof value === 'object' &&
      typeof value.epochMilliseconds === 'number'
    ) {
      return new Date(Number(value.epochMilliseconds)).toISOString();
    }
    if (Array.isArray(value)) return value.map((v) => this.serialize(v));
    if (typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, this.serialize(v)]),
      );
    }
    return value;
  }

  private getMs(value: any): number {
    if (!value) return 0;
    if (typeof value === 'object' && typeof value.epochMilliseconds === 'number')
      return Number(value.epochMilliseconds);
    if (value instanceof Date) return value.getTime();
    const p = new Date(String(value)).getTime();
    return Number.isNaN(p) ? 0 : p;
  }

  private generateReference(): string {
    return `REC-${Date.now()}-${randomUUID()
      .replace(/-/g, '')
      .slice(0, 8)
      .toUpperCase()}`;
  }

  /**
   * Create and immediately execute a reconciliation run.
   *
   * Logic:
   *   - Fetch every COMPLETED transaction whose createdAt falls within
   *     [periodStart, periodEnd].
   *   - For each transaction, sum its LedgerEntry debits and credits.
   *   - MATCHED     → sum(debit) === sum(credit) && both > 0
   *   - UNMATCHED   → no ledger entries exist
   *   - DISCREPANCY → entries exist but debit ≠ credit
   */
  async createAndExecute(
    dto: CreateReconciliationRunDto,
    adminId: number,
  ) {
    const admin =
      await this.prisma.client.orm.public.Admin.first({ id: adminId });

    if (!admin || admin.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Only active administrators can run reconciliation',
      );
    }

    const start = new Date(dto.periodStart);
    const end = new Date(dto.periodEnd);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid period dates');
    }

    if (start >= end) {
      throw new BadRequestException('periodStart must be before periodEnd');
    }

    // Create the run record
    const run =
      await this.prisma.client.orm.public.ReconciliationRun.create({
        reference: this.generateReference(),
        status: 'IN_PROGRESS',
        type: dto.type,
        periodStart: nowInstant(),   // will overwrite below via update
        periodEnd: nowInstant(),
        totalTransactions: 0,
        matchedCount: 0,
        unmatchedCount: 0,
        discrepancyCount: 0,
        totalDiscrepancyAmount: BigInt(0),
        notes: dto.notes?.trim() || null,
        failureReason: null,
        createdByAdminId: adminId,
        approvedByAdminId: null,
        approvedAt: null,
        createdAt: nowInstant(),
        updatedAt: nowInstant(),
      });

    try {
      // Fetch all COMPLETED transactions
      const allTransactions =
        await this.prisma.client.orm.public.Transaction.where({
          status: 'COMPLETED',
        }).all();

      // Filter by period on the application side
      const startMs = start.getTime();
      const endMs = end.getTime();

      const transactions = allTransactions.filter((tx: any) => {
        const ts = this.getMs(tx.createdAt);
        return ts >= startMs && ts <= endMs;
      });

      // Fetch all ledger entries relevant to these transactions
      const txIds = transactions.map((tx: any) => tx.id as number);

      const allEntries =
        await this.prisma.client.orm.public.LedgerEntry.where({}).all();

      const entriesByTxId = new Map<number, any[]>();
      for (const entry of allEntries) {
        const txId = entry.transactionId as number;
        if (!txIds.includes(txId)) continue;
        const list = entriesByTxId.get(txId) ?? [];
        list.push(entry);
        entriesByTxId.set(txId, list);
      }

      // Build reconciliation entries
      let matchedCount = 0;
      let unmatchedCount = 0;
      let discrepancyCount = 0;
      let totalDiscrepancyAmount = BigInt(0);

      for (const tx of transactions) {
        const txId = tx.id as number;
        const entries = entriesByTxId.get(txId) ?? [];

        let debitTotal = BigInt(0);
        let creditTotal = BigInt(0);

        for (const e of entries) {
          debitTotal += BigInt(e.debit ?? 0);
          creditTotal += BigInt(e.credit ?? 0);
        }

        let status: string;
        let discrepancy = BigInt(0);

        if (entries.length === 0) {
          status = 'UNMATCHED';
          unmatchedCount++;
        } else if (debitTotal === creditTotal && debitTotal > BigInt(0)) {
          status = 'MATCHED';
          matchedCount++;
        } else {
          status = 'DISCREPANCY';
          discrepancy =
            debitTotal > creditTotal
              ? debitTotal - creditTotal
              : creditTotal - debitTotal;
          discrepancyCount++;
          totalDiscrepancyAmount += discrepancy;
        }

        await this.prisma.client.orm.public.ReconciliationEntry.create({
          runId: run.id,
          transactionId: txId,
          status,
          transactionAmount: BigInt(tx.amount ?? 0),
          ledgerDebitTotal: debitTotal,
          ledgerCreditTotal: creditTotal,
          discrepancyAmount: discrepancy,
          currency: tx.currency as string,
          notes: null,
          createdAt: nowInstant(),
        });
      }

      // Update the run with results
      await this.prisma.client.orm.public.ReconciliationRun.where({
        id: run.id,
      }).update({
        status: 'COMPLETED',
        totalTransactions: transactions.length,
        matchedCount,
        unmatchedCount,
        discrepancyCount,
        totalDiscrepancyAmount,
        updatedAt: nowInstant(),
      });

      await this.auditService.create({
        adminId,
        action: 'RECONCILIATION_RUN_COMPLETED',
        entity: 'ReconciliationRun',
        entityId: String(run.id),
        metadata: JSON.stringify({
          reference: run.reference,
          type: dto.type,
          periodStart: dto.periodStart,
          periodEnd: dto.periodEnd,
          totalTransactions: transactions.length,
          matchedCount,
          unmatchedCount,
          discrepancyCount,
          totalDiscrepancyAmount: totalDiscrepancyAmount.toString(),
        }),
      });
    } catch (err) {
      await this.prisma.client.orm.public.ReconciliationRun.where({
        id: run.id,
      }).update({
        status: 'FAILED',
        failureReason: err instanceof Error ? err.message : 'Unknown error',
        updatedAt: nowInstant(),
      });

      throw err;
    }

    // Return the completed run
    const updated =
      await this.prisma.client.orm.public.ReconciliationRun.first({
        id: run.id,
      });

    return this.serialize(updated);
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const allRuns =
      await this.prisma.client.orm.public.ReconciliationRun.where({}).all();

    let runs = allRuns;
    if (query.status) runs = runs.filter((r: any) => r.status === query.status);
    if (query.type) runs = runs.filter((r: any) => r.type === query.type);

    runs.sort(
      (a: any, b: any) => this.getMs(b.createdAt) - this.getMs(a.createdAt),
    );

    const total = runs.length;
    const data = runs.slice(offset, offset + limit);

    const statistics = {
      total: allRuns.length,
      pending: allRuns.filter((r: any) => r.status === 'PENDING').length,
      inProgress: allRuns.filter((r: any) => r.status === 'IN_PROGRESS').length,
      completed: allRuns.filter((r: any) => r.status === 'COMPLETED').length,
      approved: allRuns.filter((r: any) => r.status === 'APPROVED').length,
      failed: allRuns.filter((r: any) => r.status === 'FAILED').length,
    };

    return this.serialize({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
      statistics,
    });
  }

  async findOne(id: number) {
    const run =
      await this.prisma.client.orm.public.ReconciliationRun.first({ id });

    if (!run) throw new NotFoundException('Reconciliation run not found');

    const entries =
      await this.prisma.client.orm.public.ReconciliationEntry.where({
        runId: id,
      }).all();

    return this.serialize({ ...run, entries });
  }

  async approve(id: number, adminId: number, notes?: string) {
    const admin =
      await this.prisma.client.orm.public.Admin.first({ id: adminId });

    if (!admin || admin.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Only active administrators can approve reconciliation runs',
      );
    }

    const run =
      await this.prisma.client.orm.public.ReconciliationRun.first({ id });

    if (!run) throw new NotFoundException('Reconciliation run not found');

    if (run.status !== 'COMPLETED') {
      throw new BadRequestException(
        'Only completed reconciliation runs can be approved',
      );
    }

    const updated =
      await this.prisma.client.orm.public.ReconciliationRun.where({
        id,
      }).update({
        status: 'APPROVED',
        approvedByAdminId: adminId,
        approvedAt: nowInstant(),
        ...(notes?.trim() && { notes: notes.trim() }),
        updatedAt: nowInstant(),
      });

    if (!updated) throw new NotFoundException('Run could not be approved');

    await this.auditService.create({
      adminId,
      action: 'RECONCILIATION_RUN_APPROVED',
      entity: 'ReconciliationRun',
      entityId: String(id),
      metadata: JSON.stringify({ reference: run.reference }),
    });

    return this.serialize(updated);
  }
}
