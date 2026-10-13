import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { nowInstant } from '../prisma/temporal.js';

import type { SubmitKycDto } from './dto/submit-kyc.dto.js';
import type { ReviewKycDto } from './dto/review-kyc.dto.js';

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Convert Prisma/Temporal values into
   * JSON-safe API values.
   */
  private serialize(
    value: any,
  ): any {
    if (
      value === null ||
      value === undefined
    ) {
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
      typeof value.epochMilliseconds ===
        'number'
    ) {
      return new Date(
        Number(
          value.epochMilliseconds,
        ),
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
   * Submit a new KYC application.
   *
   * One submission per user. If the user
   * has an APPROVED submission the request
   * is rejected. If a PENDING or UNDER_REVIEW
   * submission exists the user is asked to wait.
   */
  async submitKyc(
    userId: number,
    dto: SubmitKycDto,
  ): Promise<any> {
    const existing =
      await this.prisma.client.orm.public.KycSubmission.first(
        { userId },
      );

    if (existing) {
      if (existing.status === 'APPROVED') {
        throw new BadRequestException(
          'Your KYC has already been approved.',
        );
      }

      if (
        existing.status === 'PENDING' ||
        existing.status === 'UNDER_REVIEW'
      ) {
        throw new BadRequestException(
          'KYC already submitted. Please wait for review.',
        );
      }
    }

    const created =
      await this.prisma.client.orm.public.KycSubmission.create(
        {
          userId,

          status: 'PENDING',

          tier: dto.tier ?? 'BASIC',

          firstName:
            dto.firstName.trim(),

          lastName:
            dto.lastName.trim(),

          dateOfBirth:
            dto.dateOfBirth,

          nationality:
            dto.nationality.trim(),

          documentType:
            dto.documentType,

          documentNumber:
            dto.documentNumber.trim(),

          documentFrontUrl:
            dto.documentFrontUrl,

          documentBackUrl:
            dto.documentBackUrl ??
            null,

          selfieUrl:
            dto.selfieUrl ?? null,

          address:
            dto.address?.trim() ??
            null,

          reviewedByAdminId: null,

          reviewNotes: null,

          submittedAt: nowInstant(),

          reviewedAt: null,

          updatedAt: nowInstant(),
        },
      );

    return this.serialize(created);
  }

  /**
   * Return the authenticated user's KYC
   * submission, or a NOT_SUBMITTED sentinel
   * if none exists.
   */
  async getMyKyc(
    userId: number,
  ): Promise<any> {
    const submission =
      await this.prisma.client.orm.public.KycSubmission.first(
        { userId },
      );

    if (!submission) {
      return { status: 'NOT_SUBMITTED' };
    }

    return this.serialize(submission);
  }

  /**
   * Return all KYC submissions for admin use.
   * Filtering by status and tier is done
   * in application code; pagination via
   * limit/offset.
   */
  async getAllSubmissions(query: {
    status?: string;
    tier?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: any[]; total: number }> {
    const all =
      await this.prisma.client.orm.public.KycSubmission
        .where({})
        .all();

    let filtered = all as any[];

    if (query.status) {
      filtered = filtered.filter(
        (item) =>
          item.status === query.status,
      );
    }

    if (query.tier) {
      filtered = filtered.filter(
        (item) =>
          item.tier === query.tier,
      );
    }

    /**
     * Newest submissions first.
     */
    filtered.sort(
      (a: any, b: any) => {
        const getMs = (v: any): number => {
          if (!v) return 0;

          if (
            typeof v === 'object' &&
            typeof v.epochMilliseconds ===
              'number'
          ) {
            return Number(
              v.epochMilliseconds,
            );
          }

          if (v instanceof Date) {
            return v.getTime();
          }

          const parsed = new Date(
            String(v),
          ).getTime();

          return Number.isNaN(parsed)
            ? 0
            : parsed;
        };

        return (
          getMs(b.submittedAt) -
          getMs(a.submittedAt)
        );
      },
    );

    const total = filtered.length;

    const limit = Math.min(
      100,
      Math.max(1, query.limit ?? 20),
    );

    const offset = Math.max(
      0,
      query.offset ?? 0,
    );

    const data = filtered
      .slice(offset, offset + limit)
      .map((item) =>
        this.serialize(item),
      );

    return { data, total };
  }

  /**
   * Get a single KYC submission by id.
   * For admin use.
   */
  async getSubmission(
    id: number,
  ): Promise<any> {
    const submission =
      await this.prisma.client.orm.public.KycSubmission.first(
        { id },
      );

    if (!submission) {
      throw new NotFoundException(
        'KYC submission not found',
      );
    }

    return this.serialize(submission);
  }

  /**
   * Review a KYC submission.
   *
   * Updates the status, reviewer, notes,
   * and timestamp. Returns the updated record.
   */
  async reviewKyc(
    id: number,
    adminId: number,
    dto: ReviewKycDto,
  ): Promise<any> {
    const submission =
      await this.prisma.client.orm.public.KycSubmission.first(
        { id },
      );

    if (!submission) {
      throw new NotFoundException(
        'KYC submission not found',
      );
    }

    if (submission.status === 'APPROVED') {
      throw new BadRequestException(
        'This KYC submission has already been approved.',
      );
    }

    const updated =
      await this.prisma.client.orm.public.KycSubmission
        .where({ id })
        .update({
          status: dto.status,

          reviewedByAdminId: adminId,

          reviewNotes:
            dto.reviewNotes?.trim() ??
            null,

          reviewedAt: nowInstant(),

          updatedAt: nowInstant(),
        });

    if (!updated) {
      throw new NotFoundException(
        'KYC submission could not be updated',
      );
    }

    return this.serialize(updated);
  }
}
