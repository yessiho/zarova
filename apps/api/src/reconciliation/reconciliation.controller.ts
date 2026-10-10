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
  @ApiOperation({ summary: 'List reconciliation runs' })
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
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.reconciliationService.findOne(id);
  }

  @Post('runs')
  @RequirePermissions(PERMISSION_CODES.RECONCILIATION_RUN)
  @ApiOperation({
    summary: 'Create and execute a new reconciliation run',
  })
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
