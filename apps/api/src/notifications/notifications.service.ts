import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { nowInstant } from '../prisma/temporal.js';

import {
  CreateNotificationDto,
  NotificationType,
} from './dto/create-notification.dto.js';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /*
   * ==========================================
   * SERIALIZE
   *
   * Convert Temporal/BigInt values into
   * JSON-safe primitives for API responses.
   * ==========================================
   */
  private serialize<T>(data: T): T {
    return JSON.parse(
      JSON.stringify(data, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    );
  }

  /*
   * ==========================================
   * CREATE NOTIFICATION
   * ==========================================
   */
  async create(dto: CreateNotificationDto): Promise<any> {
    const notification =
      await this.prisma.client.orm.public.Notification.create({
        userId: dto.userId,
        title: dto.title,
        body: dto.body,
        _type: dto.type,
        read: false,
        metadata: dto.metadata ?? null,
        updatedAt: nowInstant(),
      });

    return this.serialize(notification);
  }

  /*
   * ==========================================
   * FIND ALL NOTIFICATIONS FOR USER
   *
   * Returns paginated results plus unread count.
   * ==========================================
   */
  async findAllForUser(
    userId: number,
    query: { read?: boolean; limit?: number; offset?: number },
  ): Promise<{ data: any[]; total: number; unread: number }> {
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;

    const offset = query.offset && query.offset >= 0 ? query.offset : 0;

    const allNotifications =
      await this.prisma.client.orm.public.Notification.all();

    let userNotifications = allNotifications.filter(
      (n: any) => n.userId === userId,
    );

    const unread = userNotifications.filter((n: any) => !n.read).length;

    if (query.read !== undefined) {
      userNotifications = userNotifications.filter(
        (n: any) => n.read === query.read,
      );
    }

    /*
     * Most recent first.
     */
    userNotifications.sort((a: any, b: any) => {
      const getMs = (v: any): number => {
        if (v == null) return 0;
        if (typeof v === 'object' && 'epochMilliseconds' in v) {
          return Number(v.epochMilliseconds);
        }
        if (v instanceof Date) return v.getTime();
        const parsed = new Date(String(v)).getTime();
        return Number.isNaN(parsed) ? 0 : parsed;
      };

      return getMs(b.createdAt) - getMs(a.createdAt);
    });

    const total = userNotifications.length;

    const data = userNotifications.slice(offset, offset + limit);

    return {
      data: this.serialize(data),
      total,
      unread,
    };
  }

  /*
   * ==========================================
   * MARK ONE NOTIFICATION AS READ
   * ==========================================
   */
  async markAsRead(id: number, userId: number): Promise<any> {
    const notification =
      await this.prisma.client.orm.public.Notification.first({ id });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if ((notification as any).userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this notification',
      );
    }

    const updated =
      await this.prisma.client.orm.public.Notification.where({
        id,
      }).update({
        read: true,
        updatedAt: nowInstant(),
      });

    return this.serialize(updated);
  }

  /*
   * ==========================================
   * MARK ALL NOTIFICATIONS AS READ
   * ==========================================
   */
  async markAllAsRead(userId: number): Promise<{ count: number }> {
    const allNotifications =
      await this.prisma.client.orm.public.Notification.all();

    const unreadForUser = allNotifications.filter(
      (n: any) => n.userId === userId && !n.read,
    );

    if (unreadForUser.length === 0) {
      return { count: 0 };
    }

    let count = 0;

    for (const notification of unreadForUser) {
      await this.prisma.client.orm.public.Notification.where({
        id: (notification as any).id,
      }).update({
        read: true,
        updatedAt: nowInstant(),
      });

      count++;
    }

    return { count };
  }

  /*
   * ==========================================
   * GET UNREAD COUNT
   * ==========================================
   */
  async getUnreadCount(userId: number): Promise<number> {
    const allNotifications =
      await this.prisma.client.orm.public.Notification.all();

    return allNotifications.filter(
      (n: any) => n.userId === userId && !n.read,
    ).length;
  }

  /*
   * ==========================================
   * DELETE NOTIFICATION
   * ==========================================
   */
  async delete(id: number, userId: number): Promise<void> {
    const notification =
      await this.prisma.client.orm.public.Notification.first({ id });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if ((notification as any).userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this notification',
      );
    }

    await this.prisma.client.orm.public.Notification.where({
      id,
    }).delete();
  }

  /*
   * ==========================================
   * NOTIFY TRANSACTION
   *
   * Convenience method for transaction events.
   * ==========================================
   */
  async notifyTransaction(
    userId: number,
    data: {
      type: string;
      amount: string;
      currency: string;
      reference: string;
    },
  ): Promise<void> {
    const title = `${data.type} Transaction`;

    const body = `Your ${data.type.toLowerCase()} of ${data.amount} ${data.currency} (ref: ${data.reference}) has been processed.`;

    await this.create({
      userId,
      title,
      body,
      type: NotificationType.TRANSACTION,
      metadata: JSON.stringify(data),
    });
  }

  /*
   * ==========================================
   * NOTIFY SECURITY ALERT
   *
   * Convenience method for security events.
   * ==========================================
   */
  async notifySecurityAlert(
    userId: number,
    title: string,
    body: string,
  ): Promise<void> {
    await this.create({
      userId,
      title,
      body,
      type: NotificationType.SECURITY,
    });
  }
}
