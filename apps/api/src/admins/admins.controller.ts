import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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

import { AdminsService } from './admins.service.js';
import { CreateAdminDto } from './dto/create-admin.dto.js';
import { RequirePermissions } from '../rbac/rbac.decorator.js';
import { PERMISSION_CODES } from '../rbac/rbac.constants.js';
import { RbacGuard } from '../rbac/rbac.guard.js';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    type?: string;
  };
}

@ApiTags('Administrators')
@ApiBearerAuth('access-token')
@Controller('admins')
@UseGuards(RbacGuard)
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  /*
   * GET /admins/dashboard/stats
   */
  @Get('dashboard/stats')
  @RequirePermissions(PERMISSION_CODES.DASHBOARD_VIEW)
  @ApiOperation({
    summary: 'Admin dashboard statistics',
    description:
      'Returns totals and 7-day chart data for the admin dashboard. Requires DASHBOARD_VIEW permission.',
  })
  @ApiResponse({ status: 200, description: 'Dashboard stats returned' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  getDashboardStats() {
    return this.adminsService.getDashboardStats();
  }

  /*
   * GET /admins
   */
  @Get()
  @RequirePermissions(PERMISSION_CODES.ADMIN_VIEW)
  @ApiOperation({
    summary: 'List all administrators',
    description: 'Returns all admin accounts. Requires ADMIN_VIEW permission.',
  })
  @ApiResponse({ status: 200, description: 'Admin list returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async findAll() {
    return this.adminsService.findAll();
  }

  /*
   * GET /admins/:id
   */
  @Get(':id')
  @RequirePermissions(PERMISSION_CODES.ADMIN_VIEW)
  @ApiOperation({ summary: 'Get an administrator by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Admin returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminsService.findOne(id);
  }

  /*
   * POST /admins
   */
  @Post()
  @RequirePermissions(PERMISSION_CODES.ADMIN_CREATE)
  @ApiOperation({
    summary: 'Create an administrator',
    description:
      'Creates a new admin account and assigns initial roles. Requires ADMIN_CREATE permission. The action is audit-logged.',
  })
  @ApiBody({ type: CreateAdminDto })
  @ApiResponse({ status: 201, description: 'Admin created' })
  @ApiResponse({ status: 400, description: 'Validation error or email already in use' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async create(
    @Body() createAdminDto: CreateAdminDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const performedByAdminId = Number(request.user?.id);

    return this.adminsService.create(
      createAdminDto,
      performedByAdminId,
    );
  }

  /*
   * PATCH /admins/:id
   */
  @Patch(':id')
  @RequirePermissions(PERMISSION_CODES.ADMIN_UPDATE)
  @ApiOperation({
    summary: 'Update an administrator profile',
    description: 'Updates the email, first name, or last name of an admin account.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Admin updated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      email?: string;
      firstName?: string;
      lastName?: string;
    },
    @Req() request: AuthenticatedRequest,
  ) {
    const performedByAdminId = Number(request.user?.id);

    return this.adminsService.update(
      id,
      body,
      performedByAdminId,
    );
  }

  /*
   * PATCH /admins/:id/status
   */
  @Patch(':id/status')
  @RequirePermissions(PERMISSION_CODES.ADMIN_SUSPEND)
  @ApiOperation({
    summary: 'Activate or suspend an administrator',
    description:
      'Sets an admin account to ACTIVE or SUSPENDED. Suspended admins cannot sign in. The action is audit-logged.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Admin status updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: 'ACTIVE' | 'SUSPENDED' },
    @Req() request: AuthenticatedRequest,
  ) {
    const performedByAdminId = Number(request.user?.id);

    return this.adminsService.updateStatus(
      id,
      body.status,
      performedByAdminId,
    );
  }
}
