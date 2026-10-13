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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { RequirePermissions } from '../rbac/rbac.decorator.js';
import { PERMISSION_CODES } from '../rbac/rbac.constants.js';
import { RbacGuard } from '../rbac/rbac.guard.js';

import { ReconciliationService } from './reconciliation.service.js';
import { CreateReconciliationRunDto } from './dto/create-reconciliation-run.dto.js';

type AdminRequest = Request & { user: { id: number } };

@ApiTags('Admin Reconciliation')
@ApiBearerAuth('access-token')
@Controller('admin/reconciliation')
@UseGuards(RbacGuard)
export class ReconciliationController {
  constructor(
    private readonly reconciliationService: ReconciliationService,
  ) {}

  @Get('runs')
  @RequirePermissions(PERMISSION_CODES.RECONCILIATION_VIEW)
  @ApiOperation({ summary: 'List reconciliation runs', description: 'Returns paginated reconciliation runs with optional status and type filters.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated reconciliation runs' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.reconciliationService.findAll({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      status: status?.trim() || undefined,
      type: type?.trim() || undefined,
    });
  }

  @Get('runs/:id')
  @RequirePermissions(PERMISSION_CODES.RECONCILIATION_VIEW)
  @ApiOperation({ summary: 'Get reconciliation run with entries' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Reconciliation run with all line entries' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Run not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.reconciliationService.findOne(id);
  }

  @Post('runs')
  @RequirePermissions(PERMISSION_CODES.RECONCILIATION_RUN)
  @ApiOperation({ summary: 'Create and execute a new reconciliation run' })
  @ApiBody({ type: CreateReconciliationRunDto })
  @ApiResponse({ status: 201, description: 'Reconciliation run created and executed' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  createAndExecute(
    @Body() dto: CreateReconciliationRunDto,
    @Req() request: AdminRequest,
  ) {
    return this.reconciliationService.createAndExecute(
      dto,
      request.user.id,
    );
  }

  @Post('runs/:id/approve')
  @RequirePermissions(PERMISSION_CODES.RECONCILIATION_APPROVE)
  @ApiOperation({ summary: 'Approve a completed reconciliation run' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 201, description: 'Run approved' })
  @ApiResponse({ status: 400, description: 'Run is not in a completed state' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Run not found' })
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { notes?: string },
    @Req() request: AdminRequest,
  ) {
    return this.reconciliationService.approve(
      id,
      request.user.id,
      body.notes,
    );
  }
}
