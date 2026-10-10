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
  ApiTags,
} from '@nestjs/swagger';

import { RequirePermissions } from '../rbac/rbac.decorator.js';
import { PERMISSION_CODES } from '../rbac/rbac.constants.js';
import { RbacGuard } from '../rbac/rbac.guard.js';

import { RiskService } from './risk.service.js';
import { CreateRiskAlertDto } from './dto/create-risk-alert.dto.js';
import { UpdateRiskAlertDto } from './dto/update-risk-alert.dto.js';
import { QueryRiskAlertsDto } from './dto/query-risk-alerts.dto.js';

type AdminRequest = Request & { user: { id: number } };

@ApiTags('Admin Risk & Fraud')
@ApiBearerAuth('access-token')
@Controller('admin/risk')
@UseGuards(RbacGuard)
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @Get('alerts')
  @RequirePermissions(PERMISSION_CODES.RISK_VIEW)
  @ApiOperation({ summary: 'List risk alerts' })
  findAll(@Query() query: QueryRiskAlertsDto) {
    return this.riskService.findAll(query);
  }

  @Get('alerts/:id')
  @RequirePermissions(PERMISSION_CODES.RISK_VIEW)
  @ApiOperation({ summary: 'Get risk alert details' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.riskService.findOne(id);
  }

  @Post('alerts')
  @RequirePermissions(PERMISSION_CODES.RISK_REVIEW)
  @ApiOperation({ summary: 'Create risk alert' })
  create(
    @Body() dto: CreateRiskAlertDto,
    @Req() request: AdminRequest,
  ) {
    return this.riskService.create(dto, request.user.id);
  }

  @Patch('alerts/:id')
  @RequirePermissions(PERMISSION_CODES.RISK_REVIEW)
  @ApiOperation({ summary: 'Update risk alert' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRiskAlertDto,
    @Req() request: AdminRequest,
  ) {
    return this.riskService.update(id, dto, request.user.id);
  }

  @Post('alerts/:id/flag')
  @RequirePermissions(PERMISSION_CODES.RISK_FLAG)
  @ApiOperation({ summary: 'Flag risk alert for review' })
  flag(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason: string },
    @Req() request: AdminRequest,
  ) {
    return this.riskService.flag(
      id,
      request.user.id,
      body.reason,
    );
  }

  @Post('alerts/:id/release')
  @RequirePermissions(PERMISSION_CODES.RISK_RELEASE)
  @ApiOperation({ summary: 'Release risk alert' })
  release(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { notes: string },
    @Req() request: AdminRequest,
  ) {
    return this.riskService.release(
      id,
      request.user.id,
      body.notes,
    );
  }

  @Post('alerts/:id/link-compliance')
  @RequirePermissions(PERMISSION_CODES.RISK_REVIEW)
  @ApiOperation({
    summary: 'Link risk alert to a compliance case',
  })
  linkCompliance(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { complianceCaseId: number },
    @Req() request: AdminRequest,
  ) {
    return this.riskService.linkCompliance(
      id,
      request.user.id,
      body.complianceCaseId,
    );
  }
}
