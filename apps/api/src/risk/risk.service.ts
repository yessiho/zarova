import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { nowInstant } from '../prisma/temporal.js';

import type { CreateRiskAlertDto } from './dto/create-risk-alert.dto.js';
import type { UpdateRiskAlertDto } from './dto/update-risk-alert.dto.js';
import type { QueryRiskAlertsDto } from './dto/query-risk-alerts.dto.js';

@Injectable()
export class RiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private serialize(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (
      typeof value === 'object' &&
      typeof value.epochMilliseconds === 'number'
    ) {
      return new Date(
        Number(value.epochMilliseconds),
      ).toISOString();
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.serialize(item));
    }

    if (typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          this.serialize(item),
        ]),
      );
    }

    return value;
  }

  private getTimestampMilliseconds(value: any): number {
    if (value === null || value === undefined) {
      return 0;
    }

    if (
      typeof value === 'object' &&
      typeof value.epochMilliseconds === 'number'
    ) {
      return Number(value.epochMilliseconds);
    }

    if (value instanceof Date) {
      return value.getTime();
    }

    const parsed = new Date(String(value)).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private generateAlertReference(): string {
    return `RSK-${Date.now()}-${randomUUID()
      .replace(/-/g, '')
      .slice(0, 10)
      .toUpperCase()}`;
  }

  private async requireActiveAdmin(adminId: number) {
    const admin =
      await this.prisma.client.orm.public.Admin.first({
        id: adminId,
      });

    if (!admin) {
      throw new NotFoundException(
        'Administrator not found',
      );
    }

    if (admin.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Only active administrators can perform risk actions',
      );
    }

    return admin;
  }

  async create(dto: CreateRiskAlertDto, adminId: number) {
    await this.requireActiveAdmin(adminId);

    const title = dto.title.trim();
    const description = dto.description.trim();

    if (!title) {
      throw new BadRequestException('Alert title is required');
    }

    if (!description) {
      throw new BadRequestException(
        'Alert description is required',
      );
    }

    if (dto.transactionId !== undefined) {
      const transaction =
        await this.prisma.client.orm.public.Transaction.first({
          id: dto.transactionId,
        });

      if (!transaction) {
        throw new NotFoundException(
          'Referenced transaction not found',
        );
      }
    }

    if (dto.walletId !== undefined) {
      const wallet =
        await this.prisma.client.orm.public.Wallet.first({
          id: dto.walletId,
        });

      if (!wallet) {
        throw new NotFoundException(
          'Referenced wallet not found',
        );
      }
    }

    if (dto.userId !== undefined) {
      const user =
        await this.prisma.client.orm.public.User.first({
          id: dto.userId,
        });

      if (!user) {
        throw new NotFoundException(
          'Referenced user not found',
        );
      }
    }

    const created =
      await this.prisma.client.orm.public.RiskAlert.create({
        reference: this.generateAlertReference(),
        type: dto.type,
        severity: dto.severity,
        status: 'OPEN',
        title,
        description,
        transactionId: dto.transactionId ?? null,
        walletId: dto.walletId ?? null,
        userId: dto.userId ?? null,
        complianceCaseId: null,
        alertCode: dto.alertCode?.trim() || null,
        createdByAdminId: adminId,
        assignedToAdminId: null,
        resolutionNotes: null,
        falsePositiveReason: null,
        flaggedByAdminId: null,
        flaggedAt: null,
        releasedByAdminId: null,
        releasedAt: null,
        createdAt: nowInstant(),
        updatedAt: nowInstant(),
      });

    await this.auditService.create({
      adminId,
      action: 'RISK_ALERT_CREATED',
      entity: 'RiskAlert',
      entityId: String(created.id),
      metadata: JSON.stringify({
        reference: created.reference,
        type: created.type,
        severity: created.severity,
        status: created.status,
        transactionId: created.transactionId,
        walletId: created.walletId,
        userId: created.userId,
      }),
    });

    return this.serialize(created);
  }

  async findAll(query: QueryRiskAlertsDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const filters: Record<string, any> = {};

    if (query.status) filters.status = query.status;
    if (query.severity) filters.severity = query.severity;
    if (query.type) filters.type = query.type;

    const [allAlerts, filteredAlerts] = await Promise.all([
      this.prisma.client.orm.public.RiskAlert.where({}).all(),
      this.prisma.client.orm.public.RiskAlert.where(
        filters,
      ).all(),
    ]);

    let alerts = filteredAlerts;

    if (query.search?.trim()) {
      const search = query.search.trim().toLowerCase();

      alerts = alerts.filter((item: any) => {
        const searchable = [
          item.reference,
          item.title,
          item.description,
          item.alertCode,
          item.type,
          item.severity,
          item.status,
        ];

        return searchable.some((v) =>
          String(v ?? '')
            .toLowerCase()
            .includes(search),
        );
      });
    }

    alerts.sort(
      (a: any, b: any) =>
        this.getTimestampMilliseconds(b.createdAt) -
        this.getTimestampMilliseconds(a.createdAt),
    );

    const total = alerts.length;
    const data = alerts.slice(offset, offset + limit);

    const statistics = {
      total: allAlerts.length,
      open: allAlerts.filter(
        (a: any) => a.status === 'OPEN',
      ).length,
      underReview: allAlerts.filter(
        (a: any) => a.status === 'UNDER_REVIEW',
      ).length,
      flagged: allAlerts.filter(
        (a: any) => a.status === 'FLAGGED',
      ).length,
      released: allAlerts.filter(
        (a: any) => a.status === 'RELEASED',
      ).length,
      falsePositive: allAlerts.filter(
        (a: any) => a.status === 'FALSE_POSITIVE',
      ).length,
      critical: allAlerts.filter(
        (a: any) => a.severity === 'CRITICAL',
      ).length,
      high: allAlerts.filter(
        (a: any) => a.severity === 'HIGH',
      ).length,
    };

    return this.serialize({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages:
          total === 0 ? 0 : Math.ceil(total / limit),
      },
      statistics,
    });
  }

  async findOne(id: number) {
    const alert =
      await this.prisma.client.orm.public.RiskAlert.first({
        id,
      });

    if (!alert) {
      throw new NotFoundException('Risk alert not found');
    }

    return this.serialize(alert);
  }

  async update(
    id: number,
    dto: UpdateRiskAlertDto,
    adminId: number,
  ) {
    await this.requireActiveAdmin(adminId);

    const existing =
      await this.prisma.client.orm.public.RiskAlert.first({
        id,
      });

    if (!existing) {
      throw new NotFoundException('Risk alert not found');
    }

    if (
      ['RELEASED', 'FALSE_POSITIVE'].includes(
        existing.status,
      ) &&
      dto.status &&
      dto.status !== existing.status
    ) {
      throw new BadRequestException(
        'A closed risk alert cannot be reopened through this endpoint',
      );
    }

    if (dto.status === 'FALSE_POSITIVE') {
      const notes =
        dto.resolutionNotes?.trim() ||
        existing.resolutionNotes;

      if (!notes) {
        throw new BadRequestException(
          'Resolution notes are required when marking an alert as a false positive',
        );
      }
    }

    const updated =
      await this.prisma.client.orm.public.RiskAlert.where({
        id,
      }).update({
        ...(dto.status !== undefined && {
          status: dto.status,
        }),
        ...(dto.severity !== undefined && {
          severity: dto.severity,
        }),
        ...(dto.title !== undefined && {
          title: dto.title.trim(),
        }),
        ...(dto.description !== undefined && {
          description: dto.description.trim(),
        }),
        ...(dto.resolutionNotes !== undefined && {
          resolutionNotes: dto.resolutionNotes.trim(),
        }),
        updatedAt: nowInstant(),
      });

    if (!updated) {
      throw new NotFoundException(
        'Risk alert could not be updated',
      );
    }

    await this.auditService.create({
      adminId,
      action: 'RISK_ALERT_UPDATED',
      entity: 'RiskAlert',
      entityId: String(id),
      metadata: JSON.stringify({
        beforeStatus: existing.status,
        afterStatus: updated.status,
        beforeSeverity: existing.severity,
        afterSeverity: updated.severity,
      }),
    });

    return this.serialize(updated);
  }

  async flag(id: number, adminId: number, reason: string) {
    await this.requireActiveAdmin(adminId);

    const cleanReason = reason?.trim();

    if (!cleanReason) {
      throw new BadRequestException(
        'Flag reason is required',
      );
    }

    if (cleanReason.length > 5000) {
      throw new BadRequestException(
        'Flag reason cannot exceed 5000 characters',
      );
    }

    const alert =
      await this.prisma.client.orm.public.RiskAlert.first({
        id,
      });

    if (!alert) {
      throw new NotFoundException('Risk alert not found');
    }

    if (['RELEASED', 'FALSE_POSITIVE'].includes(alert.status)) {
      throw new BadRequestException(
        'Closed risk alerts cannot be flagged',
      );
    }

    if (alert.status === 'FLAGGED') {
      throw new BadRequestException(
        'Risk alert is already flagged',
      );
    }

    const updated =
      await this.prisma.client.orm.public.RiskAlert.where({
        id,
      }).update({
        status: 'FLAGGED',
        falsePositiveReason: cleanReason,
        flaggedByAdminId: adminId,
        flaggedAt: nowInstant(),
        updatedAt: nowInstant(),
      });

    if (!updated) {
      throw new NotFoundException(
        'Risk alert could not be flagged',
      );
    }

    await this.auditService.create({
      adminId,
      action: 'RISK_ALERT_FLAGGED',
      entity: 'RiskAlert',
      entityId: String(id),
      metadata: JSON.stringify({
        reason: cleanReason,
        previousStatus: alert.status,
      }),
    });

    return this.serialize(updated);
  }

  async release(
    id: number,
    adminId: number,
    notes: string,
  ) {
    await this.requireActiveAdmin(adminId);

    const cleanNotes = notes?.trim();

    if (!cleanNotes) {
      throw new BadRequestException(
        'Release notes are required',
      );
    }

    if (cleanNotes.length > 5000) {
      throw new BadRequestException(
        'Release notes cannot exceed 5000 characters',
      );
    }

    const alert =
      await this.prisma.client.orm.public.RiskAlert.first({
        id,
      });

    if (!alert) {
      throw new NotFoundException('Risk alert not found');
    }

    if (alert.status === 'RELEASED') {
      throw new BadRequestException(
        'Risk alert is already released',
      );
    }

    const updated =
      await this.prisma.client.orm.public.RiskAlert.where({
        id,
      }).update({
        status: 'RELEASED',
        resolutionNotes: cleanNotes,
        releasedByAdminId: adminId,
        releasedAt: nowInstant(),
        updatedAt: nowInstant(),
      });

    if (!updated) {
      throw new NotFoundException(
        'Risk alert could not be released',
      );
    }

    await this.auditService.create({
      adminId,
      action: 'RISK_ALERT_RELEASED',
      entity: 'RiskAlert',
      entityId: String(id),
      metadata: JSON.stringify({
        notes: cleanNotes,
        previousStatus: alert.status,
      }),
    });

    return this.serialize(updated);
  }

  async linkCompliance(
    id: number,
    adminId: number,
    complianceCaseId: number,
  ) {
    await this.requireActiveAdmin(adminId);

    const alert =
      await this.prisma.client.orm.public.RiskAlert.first({
        id,
      });

    if (!alert) {
      throw new NotFoundException('Risk alert not found');
    }

    const complianceCase =
      await this.prisma.client.orm.public.ComplianceCase.first({
        id: complianceCaseId,
      });

    if (!complianceCase) {
      throw new NotFoundException('Compliance case not found');
    }

    const updated =
      await this.prisma.client.orm.public.RiskAlert.where({
        id,
      }).update({
        complianceCaseId,
        updatedAt: nowInstant(),
      });

    if (!updated) {
      throw new NotFoundException(
        'Risk alert could not be linked',
      );
    }

    await this.auditService.create({
      adminId,
      action: 'RISK_ALERT_LINKED_COMPLIANCE',
      entity: 'RiskAlert',
      entityId: String(id),
      metadata: JSON.stringify({
        complianceCaseId,
        complianceCaseReference:
          complianceCase.reference,
      }),
    });

    return this.serialize(updated);
  }
}
