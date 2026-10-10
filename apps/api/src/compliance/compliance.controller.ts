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

import { ComplianceService } from './compliance.service.js';

import { CreateComplianceCaseDto } from './dto/create-compliance-case.dto.js';
import { UpdateComplianceCaseDto } from './dto/update-compliance-case.dto.js';
import { QueryComplianceCasesDto } from './dto/query-compliance-cases.dto.js';

@ApiTags('Admin Compliance')
@ApiBearerAuth('access-token')
@Controller('admin/compliance')
@UseGuards(RbacGuard)
export class ComplianceController {
  constructor(
    private readonly complianceService: ComplianceService,
  ) {}

  @Get('cases')
  @RequirePermissions(
    PERMISSION_CODES.COMPLIANCE_VIEW,
  )
  @ApiOperation({
    summary:
      'List compliance cases',
    description:
      'Returns paginated compliance cases with filtering and dashboard statistics.',
  })
  findAll(
    @Query()
    query: QueryComplianceCasesDto,
  ) {
    return this.complianceService.findAll(
      query,
    );
  }

  @Get('cases/:id')
  @RequirePermissions(
    PERMISSION_CODES.COMPLIANCE_VIEW,
  )
  @ApiOperation({
    summary:
      'Get compliance case details',
  })
  findOne(
    @Param(
      'id',
      ParseIntPipe,
    )
    id: number,
  ) {
    return this.complianceService.findOne(
      id,
    );
  }

  @Post('cases')
  @RequirePermissions(
    PERMISSION_CODES.COMPLIANCE_REVIEW,
  )
  @ApiOperation({
    summary:
      'Create compliance case',
  })
  create(
    @Body()
    dto: CreateComplianceCaseDto,

    @Req()
    request: Request & {
      user: {
        id: number;
      };
    },
  ) {
    return this.complianceService.create(
      dto,
      request.user.id,
    );
  }

  @Patch('cases/:id')
  @RequirePermissions(
    PERMISSION_CODES.COMPLIANCE_REVIEW,
  )
  @ApiOperation({
    summary:
      'Update compliance case',
  })
  update(
    @Param(
      'id',
      ParseIntPipe,
    )
    id: number,

    @Body()
    dto: UpdateComplianceCaseDto,

    @Req()
    request: Request & {
      user: {
        id: number;
      };
    },
  ) {
    return this.complianceService.update(
      id,
      dto,
      request.user.id,
    );
  }

  @Post('cases/:id/assign')
  @RequirePermissions(
    PERMISSION_CODES.COMPLIANCE_REVIEW,
  )
  @ApiOperation({
    summary:
      'Assign compliance case',
  })
  assign(
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
    return this.complianceService.assign(
      id,
      request.user.id,
    );
  }

  @Post('cases/:id/escalate')
  @RequirePermissions(
    PERMISSION_CODES.COMPLIANCE_APPROVE,
  )
  @ApiOperation({
    summary:
      'Escalate compliance case',
  })
  escalate(
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
    return this.complianceService.escalate(
      id,
      request.user.id,
      body.reason,
    );
  }
}