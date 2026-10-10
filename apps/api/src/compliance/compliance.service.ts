import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { nowInstant } from '../prisma/temporal.js';

import type { CreateComplianceCaseDto } from './dto/create-compliance-case.dto.js';
import type { UpdateComplianceCaseDto } from './dto/update-compliance-case.dto.js';
import type { QueryComplianceCasesDto } from './dto/query-compliance-cases.dto.js';

@Injectable()
export class ComplianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Convert Prisma/Temporal values into JSON-safe API values.
   */
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
      return value.map((item) =>
        this.serialize(item),
      );
    }

    if (typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(
          ([key, item]) => [
            key,
            this.serialize(item),
          ],
        ),
      );
    }

    return value;
  }

  /**
   * Convert a database timestamp into milliseconds.
   *
   * Prisma 8 PostgreSQL Timestamptz values may
   * be returned as Temporal.Instant.
   */
  private getTimestampMilliseconds(
    value: any,
  ): number {
    if (
      value === null ||
      value === undefined
    ) {
      return 0;
    }

    if (
      typeof value === 'object' &&
      typeof value.epochMilliseconds === 'number'
    ) {
      return Number(
        value.epochMilliseconds,
      );
    }

    if (value instanceof Date) {
      return value.getTime();
    }

    const parsed = new Date(
      String(value),
    ).getTime();

    return Number.isNaN(parsed)
      ? 0
      : parsed;
  }

  /**
   * Generate a unique compliance case reference.
   */
  private generateCaseReference(): string {
    return `CMP-${Date.now()}-${randomUUID()
      .replace(/-/g, '')
      .slice(0, 10)
      .toUpperCase()}`;
  }

  /**
   * Ensure that the administrator exists
   * and is active.
   */
  private async requireActiveAdmin(
    adminId: number,
  ) {
    const admin =
      await this.prisma.client.orm.public.Admin
        .first({
          id: adminId,
        });

    if (!admin) {
      throw new NotFoundException(
        'Administrator not found',
      );
    }

    if (admin.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Only active administrators can perform compliance actions',
      );
    }

    return admin;
  }

  /**
   * Create a new compliance case.
   */
  async create(
    dto: CreateComplianceCaseDto,
    adminId: number,
  ) {
    await this.requireActiveAdmin(
      adminId,
    );

    const title = dto.title.trim();

    const description =
      dto.description.trim();

    if (!title) {
      throw new BadRequestException(
        'Case title is required',
      );
    }

    if (!description) {
      throw new BadRequestException(
        'Case description is required',
      );
    }

    /**
     * Validate transaction reference
     * when supplied.
     */
    if (
      dto.transactionId !== undefined
    ) {
      const transaction =
        await this.prisma.client.orm.public.Transaction
          .first({
            id: dto.transactionId,
          });

      if (!transaction) {
        throw new NotFoundException(
          'Referenced transaction not found',
        );
      }
    }

    /**
     * Validate wallet reference
     * when supplied.
     */
    if (
      dto.walletId !== undefined
    ) {
      const wallet =
        await this.prisma.client.orm.public.Wallet
          .first({
            id: dto.walletId,
          });

      if (!wallet) {
        throw new NotFoundException(
          'Referenced wallet not found',
        );
      }
    }

    const created =
      await this.prisma.client.orm.public.ComplianceCase.create(
        {
          reference:
            this.generateCaseReference(),

          type: dto.type,

          priority:
            dto.priority,

          status: 'OPEN',

          title,

          description,

          transactionId:
            dto.transactionId ??
            null,

          walletId:
            dto.walletId ??
            null,

          alertCode:
            dto.alertCode?.trim() ||
            null,

          createdByAdminId:
            adminId,

          assignedToAdminId:
            null,

          resolutionNotes:
            null,

          escalationReason:
            null,

          escalatedByAdminId:
            null,

          escalatedAt:
            null,

          createdAt:
            nowInstant(),

          updatedAt:
            nowInstant(),
        },
      );

    await this.auditService.create({
      adminId,

      action:
        'COMPLIANCE_CASE_CREATED',

      entity:
        'ComplianceCase',

      entityId:
        String(created.id),

      metadata:
        JSON.stringify({
          reference:
            created.reference,

          type:
            created.type,

          priority:
            created.priority,

          status:
            created.status,

          transactionId:
            created.transactionId,

          walletId:
            created.walletId,
        }),
    });

    return this.serialize(
      created,
    );
  }

  /**
   * Get paginated compliance cases.
   */
  async findAll(
    query: QueryComplianceCasesDto,
  ) {
    const page = Math.max(
      1,
      query.page ?? 1,
    );

    const limit = Math.min(
      100,
      Math.max(
        1,
        query.limit ?? 20,
      ),
    );

    const offset =
      (page - 1) * limit;

    const filters: Record<
      string,
      any
    > = {};

    if (query.status) {
      filters.status =
        query.status;
    }

    if (query.priority) {
      filters.priority =
        query.priority;
    }

    if (query.type) {
      filters.type =
        query.type;
    }

    /**
     * Fetch all cases for global statistics
     * and the filtered set for paginated results
     * in parallel.
     */
    const [allCases, filteredCases] =
      await Promise.all([
        this.prisma.client.orm.public.ComplianceCase
          .where({})
          .all(),
        this.prisma.client.orm.public.ComplianceCase
          .where(filters)
          .all(),
      ]);

    /**
     * Application-level search on the
     * filtered set only.
     */
    let cases = filteredCases;

    if (query.search?.trim()) {
      const search =
        query.search
          .trim()
          .toLowerCase();

      cases = cases.filter(
        (item: any) => {
          const searchableValues = [
            item.reference,
            item.title,
            item.description,
            item.alertCode,
            item.type,
            item.priority,
            item.status,
          ];

          return searchableValues.some(
            (value) =>
              String(value ?? '')
                .toLowerCase()
                .includes(search),
          );
        },
      );
    }

    /**
     * Newest cases first.
     */
    cases.sort(
      (a: any, b: any) =>
        this.getTimestampMilliseconds(
          b.createdAt,
        ) -
        this.getTimestampMilliseconds(
          a.createdAt,
        ),
    );

    const total =
      cases.length;

    const data =
      cases.slice(
        offset,
        offset + limit,
      );

    /**
     * Dashboard statistics always reflect
     * the full dataset regardless of filters.
     */
    const statistics = {
      total: allCases.length,

      open: allCases.filter(
        (item: any) =>
          item.status === 'OPEN',
      ).length,

      underReview: allCases.filter(
        (item: any) =>
          item.status ===
          'UNDER_REVIEW',
      ).length,

      escalated: allCases.filter(
        (item: any) =>
          item.status ===
          'ESCALATED',
      ).length,

      resolved: allCases.filter(
        (item: any) =>
          item.status ===
          'RESOLVED',
      ).length,

      dismissed: allCases.filter(
        (item: any) =>
          item.status ===
          'DISMISSED',
      ).length,

      critical: allCases.filter(
        (item: any) =>
          item.priority ===
          'CRITICAL',
      ).length,

      high: allCases.filter(
        (item: any) =>
          item.priority ===
          'HIGH',
      ).length,
    };

    return this.serialize({
      data,

      pagination: {
        page,
        limit,
        total,

        totalPages:
          total === 0
            ? 0
            : Math.ceil(
                total / limit,
              ),
      },

      statistics,
    });
  }

  /**
   * Get a single compliance case.
   */
  async findOne(
    id: number,
  ) {
    const complianceCase =
      await this.prisma.client.orm.public.ComplianceCase
        .first({
          id,
        });

    if (!complianceCase) {
      throw new NotFoundException(
        'Compliance case not found',
      );
    }

    return this.serialize(
      complianceCase,
    );
  }

  /**
   * Update a compliance case.
   */
  async update(
    id: number,
    dto: UpdateComplianceCaseDto,
    adminId: number,
  ) {
    await this.requireActiveAdmin(
      adminId,
    );

    const existing =
      await this.prisma.client.orm.public.ComplianceCase
        .first({
          id,
        });

    if (!existing) {
      throw new NotFoundException(
        'Compliance case not found',
      );
    }

    /**
     * Closed cases cannot be reopened
     * through this generic update endpoint.
     */
    if (
      ['RESOLVED', 'DISMISSED'].includes(
        existing.status,
      ) &&
      dto.status &&
      dto.status !==
        existing.status
    ) {
      throw new BadRequestException(
        'A closed compliance case cannot be reopened through this endpoint',
      );
    }

    /**
     * Resolution notes are mandatory
     * when closing a case.
     */
    if (
      dto.status === 'RESOLVED' ||
      dto.status === 'DISMISSED'
    ) {
      const resolutionNotes =
        dto.resolutionNotes?.trim() ||
        existing.resolutionNotes;

      if (!resolutionNotes) {
        throw new BadRequestException(
          'Resolution notes are required before closing a case',
        );
      }
    }

    const updated =
      await this.prisma.client.orm.public.ComplianceCase
        .where({
          id,
        })
        .update({
          ...(dto.status !==
            undefined && {
            status:
              dto.status,
          }),

          ...(dto.priority !==
            undefined && {
            priority:
              dto.priority,
          }),

          ...(dto.title !==
            undefined && {
            title:
              dto.title.trim(),
          }),

          ...(dto.description !==
            undefined && {
            description:
              dto.description.trim(),
          }),

          ...(dto.resolutionNotes !==
            undefined && {
            resolutionNotes:
              dto.resolutionNotes.trim(),
          }),

          updatedAt:
            nowInstant(),
        });

    /**
     * Prisma 8 contract typing allows
     * update() to return null.
     */
    if (!updated) {
      throw new NotFoundException(
        'Compliance case could not be updated',
      );
    }

    await this.auditService.create({
      adminId,

      action:
        'COMPLIANCE_CASE_UPDATED',

      entity:
        'ComplianceCase',

      entityId:
        String(id),

      metadata:
        JSON.stringify({
          beforeStatus:
            existing.status,

          afterStatus:
            updated.status,

          beforePriority:
            existing.priority,

          afterPriority:
            updated.priority,
        }),
    });

    return this.serialize(
      updated,
    );
  }

  /**
   * Assign a case to an administrator.
   */
  async assign(
    id: number,
    adminId: number,
  ) {
    await this.requireActiveAdmin(
      adminId,
    );

    const complianceCase =
      await this.prisma.client.orm.public.ComplianceCase
        .first({
          id,
        });

    if (!complianceCase) {
      throw new NotFoundException(
        'Compliance case not found',
      );
    }

    if (
      ['RESOLVED', 'DISMISSED'].includes(
        complianceCase.status,
      )
    ) {
      throw new BadRequestException(
        'Closed compliance cases cannot be assigned',
      );
    }

    const updated =
      await this.prisma.client.orm.public.ComplianceCase
        .where({
          id,
        })
        .update({
          assignedToAdminId:
            adminId,

          status:
            complianceCase.status ===
            'OPEN'
              ? 'UNDER_REVIEW'
              : complianceCase.status,

          updatedAt:
            nowInstant(),
        });

    if (!updated) {
      throw new NotFoundException(
        'Compliance case could not be assigned',
      );
    }

    await this.auditService.create({
      adminId,

      action:
        'COMPLIANCE_CASE_ASSIGNED',

      entity:
        'ComplianceCase',

      entityId:
        String(id),

      metadata:
        JSON.stringify({
          assignedToAdminId:
            adminId,

          previousStatus:
            complianceCase.status,

          newStatus:
            updated.status,
        }),
    });

    return this.serialize(
      updated,
    );
  }

  /**
   * Escalate a compliance case.
   */
  async escalate(
    id: number,
    adminId: number,
    reason: string,
  ) {
    await this.requireActiveAdmin(
      adminId,
    );

    const cleanReason =
      reason?.trim();

    if (!cleanReason) {
      throw new BadRequestException(
        'Escalation reason is required',
      );
    }

    if (
      cleanReason.length > 5000
    ) {
      throw new BadRequestException(
        'Escalation reason cannot exceed 5000 characters',
      );
    }

    const complianceCase =
      await this.prisma.client.orm.public.ComplianceCase
        .first({
          id,
        });

    if (!complianceCase) {
      throw new NotFoundException(
        'Compliance case not found',
      );
    }

    if (
      ['RESOLVED', 'DISMISSED'].includes(
        complianceCase.status,
      )
    ) {
      throw new BadRequestException(
        'Closed compliance cases cannot be escalated',
      );
    }

    const updated =
      await this.prisma.client.orm.public.ComplianceCase
        .where({
          id,
        })
        .update({
          status:
            'ESCALATED',

          escalationReason:
            cleanReason,

          escalatedByAdminId:
            adminId,

          escalatedAt:
            nowInstant(),

          updatedAt:
            nowInstant(),
        });

    if (!updated) {
      throw new NotFoundException(
        'Compliance case could not be escalated',
      );
    }

    await this.auditService.create({
      adminId,

      action:
        'COMPLIANCE_CASE_ESCALATED',

      entity:
        'ComplianceCase',

      entityId:
        String(id),

      metadata:
        JSON.stringify({
          reason:
            cleanReason,

          previousStatus:
            complianceCase.status,

          newStatus:
            updated.status,
        }),
    });

    return this.serialize(
      updated,
    );
  }
}