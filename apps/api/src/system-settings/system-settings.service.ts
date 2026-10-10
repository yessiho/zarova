import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { nowInstant } from '../prisma/temporal.js';

const DEFAULT_SETTINGS = [
  {
    key: 'PLATFORM_NAME',
    value: 'Zarova',
    description: 'Name of the platform displayed to users',
    category: 'GENERAL',
    dataType: 'STRING',
  },
  {
    key: 'SUPPORT_EMAIL',
    value: 'support@zarova.ng',
    description: 'Support email address shown to customers',
    category: 'GENERAL',
    dataType: 'STRING',
  },
  {
    key: 'BASE_CURRENCY',
    value: 'NGN',
    description: 'Default platform currency',
    category: 'GENERAL',
    dataType: 'STRING',
  },
  {
    key: 'TIMEZONE',
    value: 'Africa/Lagos',
    description: 'Default timezone for date/time displays',
    category: 'GENERAL',
    dataType: 'STRING',
  },
  {
    key: 'SESSION_TIMEOUT_MINUTES',
    value: '60',
    description: 'Admin session timeout in minutes (0 = no timeout)',
    category: 'SECURITY',
    dataType: 'NUMBER',
  },
  {
    key: 'REQUIRE_MFA',
    value: 'false',
    description: 'Require multi-factor authentication for all admins',
    category: 'SECURITY',
    dataType: 'BOOLEAN',
  },
  {
    key: 'MAX_LOGIN_ATTEMPTS',
    value: '5',
    description: 'Maximum failed login attempts before account lockout',
    category: 'SECURITY',
    dataType: 'NUMBER',
  },
  {
    key: 'PASSWORD_MIN_LENGTH',
    value: '8',
    description: 'Minimum password length for admin accounts',
    category: 'SECURITY',
    dataType: 'NUMBER',
  },
  {
    key: 'MAX_DEPOSIT_AMOUNT',
    value: '10000000',
    description: 'Maximum single deposit amount in kobo (NGN)',
    category: 'LIMITS',
    dataType: 'NUMBER',
  },
  {
    key: 'MAX_WITHDRAWAL_AMOUNT',
    value: '5000000',
    description: 'Maximum single withdrawal amount in kobo (NGN)',
    category: 'LIMITS',
    dataType: 'NUMBER',
  },
  {
    key: 'MAX_TRANSFER_AMOUNT',
    value: '5000000',
    description: 'Maximum single transfer amount in kobo (NGN)',
    category: 'LIMITS',
    dataType: 'NUMBER',
  },
  {
    key: 'DAILY_TRANSACTION_LIMIT',
    value: '50000000',
    description: 'Maximum total transaction value per day per user in kobo (NGN)',
    category: 'LIMITS',
    dataType: 'NUMBER',
  },
  {
    key: 'RISK_ALERT_EMAIL',
    value: 'risk@zarova.ng',
    description: 'Email address to notify when a new risk alert is raised',
    category: 'NOTIFICATIONS',
    dataType: 'STRING',
  },
  {
    key: 'COMPLIANCE_ALERT_EMAIL',
    value: 'compliance@zarova.ng',
    description: 'Email address to notify when a new compliance case is opened',
    category: 'NOTIFICATIONS',
    dataType: 'STRING',
  },
  {
    key: 'SEND_TRANSACTION_RECEIPTS',
    value: 'true',
    description: 'Send email receipts to customers after each transaction',
    category: 'NOTIFICATIONS',
    dataType: 'BOOLEAN',
  },
  {
    key: 'RECONCILIATION_REMINDER_DAYS',
    value: '7',
    description: 'Days between automatic reconciliation reminders',
    category: 'NOTIFICATIONS',
    dataType: 'NUMBER',
  },
] as const;

@Injectable()
export class SystemSettingsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    try {
      await this.seedDefaults();
    } catch (err: any) {
      console.warn('[SystemSettings] Seed skipped — table may not exist yet:', err?.message);
    }
  }

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
    if (Array.isArray(value)) return value.map((item) => this.serialize(item));
    if (typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, this.serialize(item)]),
      );
    }
    return value;
  }

  private async seedDefaults(): Promise<void> {
    for (const setting of DEFAULT_SETTINGS) {
      const existing =
        await this.prisma.client.orm.public.SystemSetting.first({
          key: setting.key,
        });

      if (!existing) {
        await this.prisma.client.orm.public.SystemSetting.create({
          key: setting.key,
          value: setting.value,
          description: setting.description,
          category: setting.category,
          dataType: setting.dataType,
          updatedByAdminId: null,
          createdAt: nowInstant(),
          updatedAt: nowInstant(),
        });
      }
    }
  }

  async findAll() {
    const settings =
      await this.prisma.client.orm.public.SystemSetting.where({}).all();

    const serialized = this.serialize(settings) as any[];

    const categoryOrder = ['GENERAL', 'SECURITY', 'LIMITS', 'NOTIFICATIONS'];

    const grouped: Record<string, any[]> = {};
    for (const setting of serialized) {
      const cat = setting.category ?? 'GENERAL';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(setting);
    }

    const orderedGroups = categoryOrder
      .filter((cat) => grouped[cat]?.length)
      .map((cat) => ({ category: cat, settings: grouped[cat] }));

    const remaining = Object.keys(grouped)
      .filter((cat) => !categoryOrder.includes(cat))
      .map((cat) => ({ category: cat, settings: grouped[cat] }));

    return {
      settings: serialized,
      grouped: [...orderedGroups, ...remaining],
    };
  }

  async update(key: string, value: string, adminId: number) {
    const existing =
      await this.prisma.client.orm.public.SystemSetting.first({ key });

    if (!existing) {
      throw new NotFoundException(`Setting "${key}" not found`);
    }

    const updated =
      await this.prisma.client.orm.public.SystemSetting.where({ key }).update({
        value: value.trim(),
        updatedByAdminId: adminId,
        updatedAt: nowInstant(),
      });

    if (!updated) {
      throw new NotFoundException('Setting could not be updated');
    }

    await this.auditService.create({
      adminId,
      action: 'SETTING_UPDATED',
      entity: 'SystemSetting',
      entityId: key,
      metadata: JSON.stringify({
        key,
        previousValue: existing.value,
        newValue: value.trim(),
        category: existing.category,
      }),
    });

    return this.serialize(updated);
  }
}
