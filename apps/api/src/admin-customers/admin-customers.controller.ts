import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
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
import { AdminCustomersService } from './admin-customers.service.js';
import { QueryAdminCustomersDto } from './dto/query-admin-customers.dto.js';

interface AdminRequest extends Request {
  user?: {
    id: number;
    type?: string;
  };
}

@ApiTags('Admin Customers')
@ApiBearerAuth('access-token')
@Controller('admin/customers')
@UseGuards(RbacGuard)
export class AdminCustomersController {
  constructor(
    private readonly customersService: AdminCustomersService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.CUSTOMER_VIEW)
  @ApiOperation({ summary: 'List customers', description: 'Returns paginated customer accounts with optional filtering by status, search, and date range.' })
  @ApiResponse({ status: 200, description: 'Paginated customer list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  findAll(@Query() query: QueryAdminCustomersDto) {
    return this.customersService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSION_CODES.CUSTOMER_VIEW)
  @ApiOperation({ summary: 'Get customer details', description: 'Returns the full profile of a customer including wallets and recent transactions.' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Customer details returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.customersService.findOne(id);
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSION_CODES.CUSTOMER_SUSPEND)
  @ApiOperation({
    summary: 'Change customer account status',
    description: 'Activate, suspend, or deactivate a customer account. The action is audit-logged.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ schema: { type: 'object', properties: { status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'] } }, required: ['status'] } })
  @ApiResponse({ status: 200, description: 'Customer status updated' })
  @ApiResponse({ status: 400, description: 'Invalid status value' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' },
    @Req() request: AdminRequest,
  ) {
    const adminId = Number(request.user?.id);

    return this.customersService.updateStatus(
      id,
      body.status,
      adminId,
    );
  }
}
