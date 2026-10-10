import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { Request } from 'express';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { RequirePermissions } from '../rbac/rbac.decorator.js';

import { PERMISSION_CODES } from '../rbac/rbac.constants.js';

import { RbacGuard } from '../rbac/rbac.guard.js';

import { AdminPaymentsService } from './admin-payments.service.js';

import { QueryAdminPaymentsDto } from './dto/query-admin-payments.dto.js';

import { CreateAdminPaymentDto } from './dto/create-admin-payment.dto.js';

@ApiTags('Admin Payments')
@ApiBearerAuth('access-token')
@Controller('admin/payments')
@UseGuards(RbacGuard)
export class AdminPaymentsController {
  constructor(
    private readonly paymentsService: AdminPaymentsService,
  ) {}

  /* ==========================================================
     CREATE PAYMENT

     POST /admin/payments

     Requires:
       PAYMENT_CREATE
     ========================================================== */

  @Post()
  @RequirePermissions(
    PERMISSION_CODES.PAYMENT_CREATE,
  )
  @ApiOperation({
    summary: 'Create a payment request',
    description:
      'Creates a new payment request in PENDING status.',
  })
  create(
    @Body()
    dto: CreateAdminPaymentDto,

    @Req()
    request: Request & {
      user: {
        id: number;
      };
    },
  ) {
    return this.paymentsService.create(
      dto,
      request.user.id,
    );
  }

  /* ==========================================================
     APPROVE PAYMENT

     POST /admin/payments/:id/approve

     Requires:
       PAYMENT_APPROVE

     Maker-checker rule:
       The administrator who created the payment
       cannot approve their own payment.
     ========================================================== */

  @Post(':id/approve')
  @RequirePermissions(
    PERMISSION_CODES.PAYMENT_APPROVE,
  )
  @ApiOperation({
    summary:
      'Approve a pending payment request',

    description:
      'Approves a pending payment request. The administrator who created the payment cannot approve it.',
  })
  approve(
    @Param(
      'id',
      ParseIntPipe,
    )
    id: number,

    @Req()
    request: Request & {
      user: {
        id: number;
      };
    },
  ) {
    return this.paymentsService.approve(
      id,
      request.user.id,
    );
  }

  /* ==========================================================
     REJECT PAYMENT

     POST /admin/payments/:id/reject

     Requires:
       PAYMENT_REJECT

     Maker-checker rule:
       The creator cannot reject their own payment.
     ========================================================== */

  @Post(':id/reject')
  @RequirePermissions(
    PERMISSION_CODES.PAYMENT_REJECT,
  )
  @ApiOperation({
    summary:
      'Reject a pending payment request',

    description:
      'Rejects a pending payment request. A rejection reason is required and the creator cannot reject their own request.',
  })
  reject(
    @Param(
      'id',
      ParseIntPipe,
    )
    id: number,

    @Body()
    body: {
      reason: string;
    },

    @Req()
    request: Request & {
      user: {
        id: number;
      };
    },
  ) {
    return this.paymentsService.reject(
      id,
      request.user.id,
      body?.reason,
    );
  }

  /* ==========================================================
     EXECUTE APPROVED PAYMENT

     POST /admin/payments/:id/execute

     Requires:
       PAYMENT_APPROVE

     Lifecycle:

       PENDING
          ↓
       APPROVED
          ↓
       PROCESSING
          ↓
       COMPLETED

     The service is responsible for making the
     wallet balance update, transaction creation,
     ledger posting and payment completion atomic.
     ========================================================== */

  @Post(':id/execute')
  @RequirePermissions(
    PERMISSION_CODES.PAYMENT_APPROVE,
  )
  @ApiOperation({
    summary:
      'Execute an approved payment',

    description:
      'Executes an approved payment atomically by updating wallet balances, creating the financial transaction, posting double-entry ledger entries, and completing the payment.',
  })
  execute(
    @Param(
      'id',
      ParseIntPipe,
    )
    id: number,

    @Req()
    request: Request & {
      user: {
        id: number;
      };
    },
  ) {
    return this.paymentsService.execute(
      id,
      request.user.id,
    );
  }

  /* ==========================================================
     LIST PAYMENTS

     GET /admin/payments

     Requires:
       PAYMENT_VIEW
     ========================================================== */

  @Get()
  @RequirePermissions(
    PERMISSION_CODES.PAYMENT_VIEW,
  )
  @ApiOperation({
    summary:
      'List payment requests for administrators',
  })
  findAll(
    @Query()
    query: QueryAdminPaymentsDto,
  ) {
    return this.paymentsService.findAll(
      query,
    );
  }

  /* ==========================================================
     PAYMENT DETAILS

     GET /admin/payments/:id

     Requires:
       PAYMENT_VIEW
     ========================================================== */

  @Get(':id')
  @RequirePermissions(
    PERMISSION_CODES.PAYMENT_VIEW,
  )
  @ApiOperation({
    summary:
      'Get payment request details',
  })
  findOne(
    @Param(
      'id',
      ParseIntPipe,
    )
    id: number,
  ) {
    return this.paymentsService.findOne(
      id,
    );
  }
}