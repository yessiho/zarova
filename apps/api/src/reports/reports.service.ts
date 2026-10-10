import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private toBigInt(value: any): bigint {
    try {
      return BigInt(value ?? 0);
    } catch {
      return 0n;
    }
  }

  async getSummary() {
    const [
      allTransactions,
      allPayments,
      allWallets,
      allUsers,
      allCompliance,
      allRisk,
      allReconciliation,
      allAuditLogs,
    ] = await Promise.all([
      this.prisma.client.orm.public.Transaction.where({}).all(),
      this.prisma.client.orm.public.Payment.where({}).all(),
      this.prisma.client.orm.public.Wallet.where({}).all(),
      this.prisma.client.orm.public.User.where({}).all(),
      this.prisma.client.orm.public.ComplianceCase.where({}).all(),
      this.prisma.client.orm.public.RiskAlert.where({}).all(),
      this.prisma.client.orm.public.ReconciliationRun.where({}).all(),
      this.prisma.client.orm.public.AuditLog.where({}).all(),
    ]);

    const completedTxns = (allTransactions as any[]).filter((t) => t.status === 'COMPLETED');
    const txnVolume = completedTxns.reduce(
      (acc: bigint, t: any) => acc + this.toBigInt(t.amount),
      0n,
    );

    const completedPayments = (allPayments as any[]).filter((p) => p.status === 'COMPLETED');
    const paymentVolume = completedPayments.reduce(
      (acc: bigint, p: any) => acc + this.toBigInt(p.amount),
      0n,
    );

    const reconMatchedTotal = (allReconciliation as any[]).reduce(
      (acc: number, r: any) => acc + (r.matchedCount ?? 0),
      0,
    );
    const reconTxnTotal = (allReconciliation as any[]).reduce(
      (acc: number, r: any) => acc + (r.totalTransactions ?? 0),
      0,
    );
    const reconDiscrepancy = (allReconciliation as any[]).reduce(
      (acc: bigint, r: any) => acc + this.toBigInt(r.totalDiscrepancyAmount),
      0n,
    );

    return {
      transactions: {
        total: (allTransactions as any[]).length,
        byStatus: {
          pending: (allTransactions as any[]).filter((t) => t.status === 'PENDING').length,
          processing: (allTransactions as any[]).filter((t) => t.status === 'PROCESSING').length,
          completed: (allTransactions as any[]).filter((t) => t.status === 'COMPLETED').length,
          failed: (allTransactions as any[]).filter((t) => t.status === 'FAILED').length,
          reversed: (allTransactions as any[]).filter((t) => t.status === 'REVERSED').length,
        },
        byType: {
          deposit: (allTransactions as any[]).filter((t) => t._type === 'DEPOSIT').length,
          withdrawal: (allTransactions as any[]).filter((t) => t._type === 'WITHDRAWAL').length,
          transfer: (allTransactions as any[]).filter((t) => t._type === 'TRANSFER').length,
        },
        completedVolume: txnVolume.toString(),
      },

      payments: {
        total: (allPayments as any[]).length,
        byStatus: {
          pending: (allPayments as any[]).filter((p) => p.status === 'PENDING').length,
          approved: (allPayments as any[]).filter((p) => p.status === 'APPROVED').length,
          rejected: (allPayments as any[]).filter((p) => p.status === 'REJECTED').length,
          processing: (allPayments as any[]).filter((p) => p.status === 'PROCESSING').length,
          completed: (allPayments as any[]).filter((p) => p.status === 'COMPLETED').length,
          failed: (allPayments as any[]).filter((p) => p.status === 'FAILED').length,
        },
        completedVolume: paymentVolume.toString(),
      },

      wallets: {
        total: (allWallets as any[]).length,
        byStatus: {
          active: (allWallets as any[]).filter((w) => w.status === 'ACTIVE').length,
          frozen: (allWallets as any[]).filter((w) => w.status === 'FROZEN').length,
          closed: (allWallets as any[]).filter((w) => w.status === 'CLOSED').length,
        },
        byCurrency: {
          ngn: (allWallets as any[]).filter((w) => w.currency === 'NGN').length,
          usd: (allWallets as any[]).filter((w) => w.currency === 'USD').length,
          eur: (allWallets as any[]).filter((w) => w.currency === 'EUR').length,
          gbp: (allWallets as any[]).filter((w) => w.currency === 'GBP').length,
        },
      },

      users: {
        total: (allUsers as any[]).length,
        byStatus: {
          active: (allUsers as any[]).filter((u) => u.status === 'ACTIVE').length,
          suspended: (allUsers as any[]).filter((u) => u.status === 'SUSPENDED').length,
          deactivated: (allUsers as any[]).filter((u) => u.status === 'DEACTIVATED').length,
        },
      },

      compliance: {
        total: (allCompliance as any[]).length,
        byStatus: {
          open: (allCompliance as any[]).filter((c) => c.status === 'OPEN').length,
          underReview: (allCompliance as any[]).filter((c) => c.status === 'UNDER_REVIEW').length,
          escalated: (allCompliance as any[]).filter((c) => c.status === 'ESCALATED').length,
          resolved: (allCompliance as any[]).filter((c) => c.status === 'RESOLVED').length,
          dismissed: (allCompliance as any[]).filter((c) => c.status === 'DISMISSED').length,
        },
        byPriority: {
          critical: (allCompliance as any[]).filter((c) => c.priority === 'CRITICAL').length,
          high: (allCompliance as any[]).filter((c) => c.priority === 'HIGH').length,
          medium: (allCompliance as any[]).filter((c) => c.priority === 'MEDIUM').length,
          low: (allCompliance as any[]).filter((c) => c.priority === 'LOW').length,
        },
      },

      risk: {
        total: (allRisk as any[]).length,
        byStatus: {
          open: (allRisk as any[]).filter((r) => r.status === 'OPEN').length,
          underReview: (allRisk as any[]).filter((r) => r.status === 'UNDER_REVIEW').length,
          flagged: (allRisk as any[]).filter((r) => r.status === 'FLAGGED').length,
          released: (allRisk as any[]).filter((r) => r.status === 'RELEASED').length,
          falsePositive: (allRisk as any[]).filter((r) => r.status === 'FALSE_POSITIVE').length,
        },
        bySeverity: {
          critical: (allRisk as any[]).filter((r) => r.severity === 'CRITICAL').length,
          high: (allRisk as any[]).filter((r) => r.severity === 'HIGH').length,
          medium: (allRisk as any[]).filter((r) => r.severity === 'MEDIUM').length,
          low: (allRisk as any[]).filter((r) => r.severity === 'LOW').length,
        },
      },

      reconciliation: {
        total: (allReconciliation as any[]).length,
        byStatus: {
          pending: (allReconciliation as any[]).filter((r) => r.status === 'PENDING').length,
          inProgress: (allReconciliation as any[]).filter((r) => r.status === 'IN_PROGRESS').length,
          completed: (allReconciliation as any[]).filter((r) => r.status === 'COMPLETED').length,
          approved: (allReconciliation as any[]).filter((r) => r.status === 'APPROVED').length,
          failed: (allReconciliation as any[]).filter((r) => r.status === 'FAILED').length,
        },
        overallMatchRate:
          reconTxnTotal > 0 ? Math.round((reconMatchedTotal / reconTxnTotal) * 100) : 0,
        totalDiscrepancy: reconDiscrepancy.toString(),
      },

      activity: {
        totalAuditLogs: (allAuditLogs as any[]).length,
      },
    };
  }
}
