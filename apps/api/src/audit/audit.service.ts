import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

interface CreateAuditLogInput {
  userId?: number;
  adminId?: number;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: string;
}

interface FindAuditLogsOptions {
  page?: number;
  limit?: number;
  action?: string;
  entity?: string;
  userId?: number;
  adminId?: number;
  search?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Convert a database timestamp into milliseconds without
   * calling valueOf() on Temporal.Instant.
   *
   * Prisma 8's PostgreSQL runtime returns Timestamptz values
   * as Temporal.Instant. Temporal.Instant.valueOf() is
   * intentionally forbidden, so Date/Temporal conversion
   * must be explicit.
   */
  private getTimestampMilliseconds(value: any): number {
    if (value == null) {
      return 0;
    }

    if (
      typeof value === 'object' &&
      'epochMilliseconds' in value
    ) {
      return Number(value.epochMilliseconds);
    }

    if (value instanceof Date) {
      return value.getTime();
    }

    const parsed = new Date(String(value)).getTime();

    return Number.isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Create an immutable audit record.
   *
   * userId is used for customer/user actions.
   * adminId is used for administrator actions.
   */
  async create(input: CreateAuditLogInput) {
    const auditLog =
      await this.prisma.client.orm.public.AuditLog.create({
        userId: input.userId ?? null,
        adminId: input.adminId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        metadata: input.metadata ?? null,
      });

    return this.formatAuditLog(auditLog);
  }

  /**
   * Get audit logs with pagination and optional filters.
   */
  async findAll(
    options: FindAuditLogsOptions = {},
  ): Promise<any> {
    const page =
      options.page && options.page > 0
        ? Math.floor(options.page)
        : 1;

    const limit =
      options.limit && options.limit > 0
        ? Math.min(Math.floor(options.limit), 100)
        : 20;

    const auditLogs =
      await this.prisma.client.orm.public.AuditLog.all();

    let filteredLogs = auditLogs.filter((log: any) => {
      if (
        options.action &&
        log.action !== options.action
      ) {
        return false;
      }

      if (
        options.entity &&
        log.entity !== options.entity
      ) {
        return false;
      }

      if (
        options.userId !== undefined &&
        log.userId !== options.userId
      ) {
        return false;
      }

      if (
        options.adminId !== undefined &&
        log.adminId !== options.adminId
      ) {
        return false;
      }

      if (options.search) {
        const term = options.search.toLowerCase();
        const searchable = [
          log.action,
          log.entity,
          log.entityId,
          log.metadata,
          String(log.userId ?? ''),
          String(log.adminId ?? ''),
        ];
        const matches = searchable.some((v) =>
          String(v ?? '').toLowerCase().includes(term),
        );
        if (!matches) return false;
      }

      return true;
    });

    filteredLogs = filteredLogs.sort(
      (a: any, b: any) =>
        this.getTimestampMilliseconds(b.createdAt) -
        this.getTimestampMilliseconds(a.createdAt),
    );

    const total = filteredLogs.length;

    const totalPages =
      total === 0
        ? 0
        : Math.ceil(total / limit);

    const startIndex = (page - 1) * limit;

    const paginatedLogs = filteredLogs.slice(
      startIndex,
      startIndex + limit,
    );

    return {
      data: paginatedLogs.map((log: any) =>
        this.formatAuditLog(log),
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get audit logs for one user.
   */
  async findByUser(
    userId: number,
    options: {
      page?: number;
      limit?: number;
      action?: string;
      entity?: string;
    } = {},
  ): Promise<any> {
    return this.findAll({
      page: options.page,
      limit: options.limit,
      action: options.action,
      entity: options.entity,
      userId,
    });
  }

  /**
   * Get audit logs for one administrator.
   */
  async findByAdmin(
    adminId: number,
    options: {
      page?: number;
      limit?: number;
      action?: string;
      entity?: string;
    } = {},
  ): Promise<any> {
    return this.findAll({
      page: options.page,
      limit: options.limit,
      action: options.action,
      entity: options.entity,
      adminId,
    });
  }

  /**
   * Get audit logs by entity and optionally entity ID.
   */
  async findByEntity(
    entity: string,
    entityId?: string,
  ): Promise<any[]> {
    const auditLogs =
      await this.prisma.client.orm.public.AuditLog.all();

    const logs = auditLogs
      .filter((log: any) => {
        const entityMatches =
          log.entity === entity;

        const entityIdMatches =
          entityId === undefined ||
          log.entityId === entityId;

        return (
          entityMatches &&
          entityIdMatches
        );
      })
      .sort(
        (a: any, b: any) =>
          this.getTimestampMilliseconds(
            b.createdAt,
          ) -
          this.getTimestampMilliseconds(
            a.createdAt,
          ),
      );

    return logs.map((log: any) =>
      this.formatAuditLog(log),
    );
  }

  /**
   * Get audit logs by action.
   */
  async findByAction(
    action: string,
  ): Promise<any[]> {
    const auditLogs =
      await this.prisma.client.orm.public.AuditLog.all();

    const logs = auditLogs
      .filter(
        (log: any) =>
          log.action === action,
      )
      .sort(
        (a: any, b: any) =>
          this.getTimestampMilliseconds(
            b.createdAt,
          ) -
          this.getTimestampMilliseconds(
            a.createdAt,
          ),
      );

    return logs.map((log: any) =>
      this.formatAuditLog(log),
    );
  }

  /**
   * Convert metadata JSON strings into objects where possible.
   *
   * BigInt values are converted to strings so the API response
   * remains JSON-safe.
   */
  private formatAuditLog(auditLog: any) {
    let metadata = auditLog.metadata;

    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch {
        // Keep invalid/non-JSON metadata unchanged.
      }
    }

    return JSON.parse(
      JSON.stringify(
        {
          ...auditLog,
          metadata,
        },
        (_, value) =>
          typeof value === 'bigint'
            ? value.toString()
            : value,
      ),
    );
  }
}