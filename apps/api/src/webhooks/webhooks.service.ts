import crypto from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';

import { PrismaService } from '../prisma/prisma.service.js';
import { nowInstant } from '../prisma/temporal.js';

import { CreateWebhookDto } from './dto/create-webhook.dto.js';
import { UpdateWebhookDto } from './dto/update-webhook.dto.js';
import { WEBHOOK_EVENTS } from './webhook-events.constants.js';

/*
 * Maximum number of webhooks a single user may register.
 */
const MAX_WEBHOOKS_PER_USER = 5;

/*
 * Outbound HTTP timeout in milliseconds.
 */
const DELIVER_TIMEOUT_MS = 10_000;

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

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
   * STRIP SECRET
   *
   * Remove the secret field before returning
   * webhook records to API consumers.
   * ==========================================
   */
  private stripSecret<T extends { secret?: unknown }>(
    webhook: T,
  ): Omit<T, 'secret'> {
    const { secret: _secret, ...rest } = webhook;
    return rest as Omit<T, 'secret'>;
  }

  /*
   * ==========================================
   * ASSERT OWNERSHIP
   *
   * Throws NotFoundException / ForbiddenException
   * when the webhook does not exist or belongs
   * to a different user.
   * ==========================================
   */
  private async assertOwnership(
    id: number,
    userId: number,
  ): Promise<any> {
    const webhook = await this.prisma.client.orm.public.Webhook.first({ id });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    if ((webhook as any).userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this webhook',
      );
    }

    return webhook;
  }

  /*
   * ==========================================
   * CREATE WEBHOOK
   * ==========================================
   */
  async create(userId: number, dto: CreateWebhookDto): Promise<any> {
    const all = await this.prisma.client.orm.public.Webhook.all();

    const userWebhooks = all.filter((w: any) => w.userId === userId);

    if (userWebhooks.length >= MAX_WEBHOOKS_PER_USER) {
      throw new BadRequestException(
        `You may not register more than ${MAX_WEBHOOKS_PER_USER} webhooks`,
      );
    }

    const secret = crypto.randomBytes(32).toString('hex');

    const webhook = await this.prisma.client.orm.public.Webhook.create({
      userId,
      url: dto.url,
      secret,
      events: JSON.stringify(dto.events),
      isActive: true,
      description: dto.description ?? null,
      updatedAt: nowInstant(),
    });

    return this.serialize(webhook);
  }

  /*
   * ==========================================
   * FIND ALL WEBHOOKS FOR USER
   *
   * The secret is never included in list results.
   * ==========================================
   */
  async findAll(userId: number): Promise<any[]> {
    const all = await this.prisma.client.orm.public.Webhook.all();

    const userWebhooks = all.filter((w: any) => w.userId === userId);

    return userWebhooks.map((w: any) =>
      this.serialize(this.stripSecret(w)),
    );
  }

  /*
   * ==========================================
   * FIND ONE WEBHOOK
   *
   * Verifies ownership and returns the full
   * record (including secret).
   * ==========================================
   */
  async findOne(id: number, userId: number): Promise<any> {
    const webhook = await this.assertOwnership(id, userId);

    return this.serialize(webhook);
  }

  /*
   * ==========================================
   * UPDATE WEBHOOK
   * ==========================================
   */
  async update(
    id: number,
    userId: number,
    dto: UpdateWebhookDto,
  ): Promise<any> {
    await this.assertOwnership(id, userId);

    const patch: Record<string, unknown> = { updatedAt: nowInstant() };

    if (dto.url !== undefined) patch.url = dto.url;
    if (dto.events !== undefined) patch.events = JSON.stringify(dto.events);
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;

    const updated = await this.prisma.client.orm.public.Webhook.where({
      id,
    }).update(patch);

    return this.serialize(updated);
  }

  /*
   * ==========================================
   * DELETE WEBHOOK
   * ==========================================
   */
  async delete(id: number, userId: number): Promise<void> {
    await this.assertOwnership(id, userId);

    await this.prisma.client.orm.public.Webhook.where({ id }).delete();
  }

  /*
   * ==========================================
   * GET DELIVERIES
   *
   * Returns paginated delivery history for a
   * webhook after verifying ownership.
   * ==========================================
   */
  async getDeliveries(
    webhookId: number,
    userId: number,
    query: { limit?: number; offset?: number },
  ): Promise<{ data: any[]; total: number }> {
    await this.assertOwnership(webhookId, userId);

    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;

    const offset = query.offset && query.offset >= 0 ? query.offset : 0;

    const all =
      await this.prisma.client.orm.public.WebhookDelivery.all();

    const deliveries = all
      .filter((d: any) => d.webhookId === webhookId)
      .sort((a: any, b: any) => {
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

    const total = deliveries.length;

    const data = deliveries.slice(offset, offset + limit);

    return {
      data: this.serialize(data),
      total,
    };
  }

  /*
   * ==========================================
   * DISPATCH
   *
   * Find all active webhooks for the user that
   * subscribe to the given event, create a
   * PENDING delivery record for each, and fire
   * the delivery in a fire-and-forget fashion.
   * ==========================================
   */
  async dispatch(
    event: string,
    userId: number,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const all = await this.prisma.client.orm.public.Webhook.all();

    const targets = all.filter((w: any) => {
      if (!w.isActive || w.userId !== userId) return false;

      try {
        const subscribedEvents: string[] = JSON.parse(w.events as string);
        return subscribedEvents.includes(event);
      } catch {
        return false;
      }
    });

    for (const webhook of targets) {
      /*
       * Create a PENDING delivery record synchronously so callers
       * can observe it, then deliver asynchronously.
       */
      const delivery =
        await this.prisma.client.orm.public.WebhookDelivery.create({
          webhookId: (webhook as any).id,
          event,
          payload: JSON.stringify(payload),
          status: 'PENDING',
          attempt: 1,
        });

      /*
       * Fire-and-forget — intentionally not awaited.
       */
      void this.deliver(delivery as any, webhook as any).catch((err: unknown) => {
        this.logger.error(
          `Unhandled error during webhook delivery id=${(delivery as any).id}: ${String(err)}`,
        );
      });
    }
  }

  /*
   * ==========================================
   * DELIVER (PRIVATE)
   *
   * POST the payload to the webhook URL with
   * an HMAC-SHA256 signature header.
   * Retries up to 3 attempts with exponential
   * back-off before marking as FAILED.
   * ==========================================
   */
  private async deliver(delivery: any, webhook: any): Promise<void> {
    const payload: Record<string, unknown> = JSON.parse(
      delivery.payload as string,
    );

    const bodyString = JSON.stringify(payload);

    const signature =
      'sha256=' +
      crypto
        .createHmac('sha256', webhook.secret as string)
        .update(bodyString)
        .digest('hex');

    try {
      const response = await axios.post(webhook.url as string, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Zarova-Signature': signature,
          'X-Zarova-Event': delivery.event as string,
          'X-Zarova-Delivery': String((delivery as any).id),
        },
        timeout: DELIVER_TIMEOUT_MS,
        validateStatus: () => true, // handle all status codes manually
      });

      const isSuccess =
        response.status >= 200 && response.status < 300;

      if (isSuccess) {
        await this.prisma.client.orm.public.WebhookDelivery.where({
          id: (delivery as any).id,
        }).update({
          status: 'DELIVERED',
          responseCode: response.status,
          responseBody: String(response.data).slice(0, 4096),
          deliveredAt: nowInstant(),
        });

        return;
      }

      /*
       * Non-2xx — treat as a failure and schedule a retry when
       * the attempt count allows.
       */
      await this.scheduleRetryOrFail(delivery, webhook, {
        responseCode: response.status,
        responseBody: String(response.data).slice(0, 4096),
        error: `HTTP ${response.status}`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      await this.scheduleRetryOrFail(delivery, webhook, {
        error: message,
      });
    }
  }

  /*
   * ==========================================
   * SCHEDULE RETRY OR FAIL (PRIVATE)
   *
   * Increments attempt counter. If under the
   * limit, marks as RETRYING and schedules the
   * next delivery. Otherwise marks as FAILED.
   * ==========================================
   */
  private async scheduleRetryOrFail(
    delivery: any,
    webhook: any,
    meta: {
      responseCode?: number;
      responseBody?: string;
      error?: string;
    },
  ): Promise<void> {
    const currentAttempt: number = (delivery.attempt as number) ?? 1;
    const MAX_ATTEMPTS = 3;

    if (currentAttempt < MAX_ATTEMPTS) {
      /*
       * Exponential back-off: 2^attempt minutes.
       * attempt=1 → 2 min, attempt=2 → 4 min.
       */
      const delayMinutes = Math.pow(2, currentAttempt);

      const nextRetryAt = nowInstant().add({
        seconds: delayMinutes * 60,
      });

      await this.prisma.client.orm.public.WebhookDelivery.where({
        id: (delivery as any).id,
      }).update({
        status: 'RETRYING',
        attempt: currentAttempt + 1,
        nextRetryAt,
        responseCode: meta.responseCode ?? null,
        responseBody: meta.responseBody ?? null,
        error: meta.error ?? null,
      });

      /*
       * Schedule the retry after the back-off delay.
       */
      setTimeout(
        () => {
          void this.deliver(
            { ...delivery, attempt: currentAttempt + 1 },
            webhook,
          ).catch((err: unknown) => {
            this.logger.error(
              `Retry failed for delivery id=${(delivery as any).id}: ${String(err)}`,
            );
          });
        },
        delayMinutes * 60 * 1000,
      );
    } else {
      await this.prisma.client.orm.public.WebhookDelivery.where({
        id: (delivery as any).id,
      }).update({
        status: 'FAILED',
        responseCode: meta.responseCode ?? null,
        responseBody: meta.responseBody ?? null,
        error: meta.error ?? null,
      });
    }
  }

  /*
   * ==========================================
   * SEND TEST PING
   *
   * Dispatches a synthetic ping event to the
   * webhook so the owner can verify connectivity.
   * ==========================================
   */
  async sendTestPing(id: number, userId: number): Promise<any> {
    const webhook = await this.assertOwnership(id, userId);

    const payload = {
      event: WEBHOOK_EVENTS.TRANSACTION_COMPLETED,
      test: true,
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test delivery from Zarova',
      },
    };

    const delivery =
      await this.prisma.client.orm.public.WebhookDelivery.create({
        webhookId: (webhook as any).id,
        event: 'TEST_PING',
        payload: JSON.stringify(payload),
        status: 'PENDING',
        attempt: 1,
      });

    void this.deliver(delivery as any, webhook as any).catch(
      (err: unknown) => {
        this.logger.error(
          `Test ping delivery failed for webhook id=${(webhook as any).id}: ${String(err)}`,
        );
      },
    );

    return this.serialize(delivery);
  }
}
