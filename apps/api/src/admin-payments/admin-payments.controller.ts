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
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
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

  @Post()
  @RequirePermissions(PERMISSION_CODES.PAYMENT_CREATE)
  @ApiOperation({
    summary: 'Create a payment request',
    description: 'Creates a new payment request in PENDING status. Requires a separate approval step (maker-checker).',
  })
  @ApiBody({ type: CreateAdminPaymentDto })
  @ApiResponse({ status: 201, description: 'Payment request created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  create(
    @Body() dto: CreateAdminPaymentDto,
    @Req() request: Request & { user: { id: number } },
  ) {
    return this.paymentsService.create(dto, request.user.id);
  }

  @Post(':id/approve')
  @RequirePermissions(PERMISSION_CODES.PAYMENT_APPROVE)
  @ApiOperation({
    summary: 'Approve a pending payment request',
    description:
      'Approves a pending payment request. The administrator who created the payment cannot approve their own request (maker-checker control).',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 201, description: 'Payment approved' })
  @ApiResponse({ status: 400, description: 'Cannot self-approve or payment is not in PENDING status' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request & { user: { id: number } },
  ) {
    return this.paymentsService.approve(id, request.user.id);
  }

  @Post(':id/reject')
  @RequirePermissions(PERMISSION_CODES.PAYMENT_REJECT)
  @ApiOperation({
    summary: 'Reject a pending payment request',
    description: 'Rejects a pending payment request with a mandatory reason. The creator cannot reject their own request.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ schema: { type: 'object', properties: { reason: { type: 'string' } }, required: ['reason'] } })
  @ApiResponse({ status: 201, description: 'Payment rejected' })
  @ApiResponse({ status: 400, description: 'Cannot self-reject or payment is not in PENDING status' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason: string },
    @Req() request: Request & { user: { id: number } },
  ) {
    return this.paymentsService.reject(id, request.user.id, body?.reason);
  }

  @Post(':id/execute')
  @RequirePermissions(PERMISSION_CODES.PAYMENT_APPROVE)
  @ApiOperation({
    summary: 'Execute an approved payment',
    description:
      'Atomically executes an approved payment: updates wallet balances, creates the financial transaction, posts double-entry ledger entries, and marks the payment as COMPLETED.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 201, description: 'Payment executed successfully' })
  @ApiResponse({ status: 400, description: 'Payment is not in APPROVED status' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  execute(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request & { user: { id: number } },
  ) {
    return this.paymentsService.execute(id, request.user.id);
  }

  @Get()
  @RequirePermissions(PERMISSION_CODES.PAYMENT_VIEW)
  @ApiOperation({ summary: 'List payment requests', description: 'Returns paginated payment requests with optional status and date filters.' })
  @ApiResponse({ status: 200, description: 'Paginated payment list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  findAll(@Query() query: QueryAdminPaymentsDto) {
    return this.paymentsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSION_CODES.PAYMENT_VIEW)
  @ApiOperation({ summary: 'Get payment request details' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Payment detail returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.paymentsService.findOne(id);
  }
}
