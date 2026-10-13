import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { Request } from 'express';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RbacGuard } from '../rbac/rbac.guard.js';
import { RequirePermissions } from '../rbac/rbac.decorator.js';
import { PERMISSION_CODES } from '../rbac/rbac.constants.js';

import { KycService } from './kyc.service.js';
import { SubmitKycDto } from './dto/submit-kyc.dto.js';
import { ReviewKycDto } from './dto/review-kyc.dto.js';

/* ----------------------------------------------------------------
 * User-facing KYC routes
 * ---------------------------------------------------------------- */

@ApiTags('KYC')
@ApiBearerAuth('access-token')
@Controller('kyc')
@UseGuards(JwtAuthGuard)
export class KycUserController {
  constructor(
    private readonly kycService: KycService,
  ) {}

  /**
   * POST /kyc/submit
   *
   * Submit a new KYC application.
   */
  @Post('submit')
  @ApiOperation({
    summary: 'Submit KYC application',
    description:
      'Submit identity documents and personal information for KYC verification. One submission is allowed per user.',
  })
  @ApiResponse({
    status: 201,
    description: 'KYC application submitted successfully',
  })
  @ApiResponse({
    status: 400,
    description:
      'Submission already exists or validation error',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  submitKyc(
    @Body()
    dto: SubmitKycDto,

    @Req()
    req: Request & {
      user: { id: number; type: string };
    },
  ) {
    return this.kycService.submitKyc(
      req.user.id,
      dto,
    );
  }

  /**
   * GET /kyc/status
   *
   * Get the authenticated user's KYC status.
   */
  @Get('status')
  @ApiOperation({
    summary: 'Get my KYC status',
    description:
      "Returns the authenticated user's KYC submission, or { status: 'NOT_SUBMITTED' } if none exists.",
  })
  @ApiResponse({
    status: 200,
    description: 'KYC status returned',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  getMyKyc(
    @Req()
    req: Request & {
      user: { id: number; type: string };
    },
  ) {
    return this.kycService.getMyKyc(
      req.user.id,
    );
  }
}

/* ----------------------------------------------------------------
 * Admin KYC routes
 * ---------------------------------------------------------------- */

@ApiTags('Admin KYC')
@ApiBearerAuth('access-token')
@Controller('admin/kyc')
@UseGuards(RbacGuard)
export class KycAdminController {
  constructor(
    private readonly kycService: KycService,
  ) {}

  /**
   * GET /admin/kyc
   *
   * List all KYC submissions with optional
   * filtering and pagination.
   */
  @Get()
  @RequirePermissions(
    PERMISSION_CODES.COMPLIANCE_VIEW,
  )
  @ApiOperation({
    summary: 'List all KYC submissions',
    description:
      'Returns paginated KYC submissions. Optionally filter by status and/or tier.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [
      'PENDING',
      'UNDER_REVIEW',
      'APPROVED',
      'REJECTED',
    ],
  })
  @ApiQuery({
    name: 'tier',
    required: false,
    enum: ['BASIC', 'STANDARD', 'PREMIUM'],
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Page size (max 100, default 20)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of records to skip (default 0)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of KYC submissions',
  })
  getAllSubmissions(
    @Query('status')
    status?: string,

    @Query('tier')
    tier?: string,

    @Query('limit')
    limit?: string,

    @Query('offset')
    offset?: string,
  ) {
    return this.kycService.getAllSubmissions({
      status,
      tier,
      limit: limit !== undefined
        ? parseInt(limit, 10)
        : undefined,
      offset: offset !== undefined
        ? parseInt(offset, 10)
        : undefined,
    });
  }

  /**
   * GET /admin/kyc/:id
   *
   * Get a single KYC submission by id.
   */
  @Get(':id')
  @RequirePermissions(
    PERMISSION_CODES.COMPLIANCE_VIEW,
  )
  @ApiOperation({
    summary: 'Get a KYC submission',
    description:
      'Returns the full details of a single KYC submission by its id.',
  })
  @ApiResponse({
    status: 200,
    description: 'KYC submission returned',
  })
  @ApiResponse({
    status: 404,
    description: 'Submission not found',
  })
  getSubmission(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.kycService.getSubmission(id);
  }

  /**
   * PATCH /admin/kyc/:id/review
   *
   * Review (approve, reject, or mark as
   * under review) a KYC submission.
   */
  @Patch(':id/review')
  @RequirePermissions(
    PERMISSION_CODES.COMPLIANCE_REVIEW,
  )
  @ApiOperation({
    summary: 'Review a KYC submission',
    description:
      'Update the status of a KYC submission. Admins can approve, reject, or mark submissions as under review.',
  })
  @ApiResponse({
    status: 200,
    description: 'KYC submission updated',
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid status transition or submission already approved',
  })
  @ApiResponse({
    status: 404,
    description: 'Submission not found',
  })
  reviewKyc(
    @Param('id', ParseIntPipe)
    id: number,

    @Body()
    dto: ReviewKycDto,

    @Req()
    req: Request & {
      user: { id: number; type: string };
    },
  ) {
    return this.kycService.reviewKyc(
      id,
      req.user.id,
      dto,
    );
  }
}
