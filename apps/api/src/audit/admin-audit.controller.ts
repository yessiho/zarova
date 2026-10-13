import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { RequirePermissions } from '../rbac/rbac.decorator.js';
import { PERMISSION_CODES } from '../rbac/rbac.constants.js';
import { RbacGuard } from '../rbac/rbac.guard.js';
import { AuditService } from './audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('Admin Audit Logs')
@ApiBearerAuth('access-token')
@Controller('admin/audit-logs')
@UseGuards(RbacGuard)
export class AdminAuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.AUDIT_LOG_VIEW)
  @ApiOperation({
    summary: 'List audit logs',
    description: 'Returns paginated audit logs with optional filters for action, entity type, admin, user, or free-text search.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'action', required: false, type: String, description: 'Filter by action type (e.g. CUSTOMER_SUSPENDED)' })
  @ApiQuery({ name: 'entity', required: false, type: String, description: 'Filter by entity type (e.g. User, Wallet)' })
  @ApiQuery({ name: 'adminId', required: false, type: Number, description: 'Filter by acting admin ID' })
  @ApiQuery({ name: 'userId', required: false, type: Number, description: 'Filter by affected user ID' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Full-text search across log details' })
  @ApiResponse({ status: 200, description: 'Paginated audit log entries' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('adminId') adminId?: string,
    @Query('userId') userId?: string,
    @Query('search') search?: string,
  ) {
    return this.auditService.findAll({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      action: action?.trim() || undefined,
      entity: entity?.trim() || undefined,
      adminId: adminId ? Number(adminId) : undefined,
      userId: userId ? Number(userId) : undefined,
      search: search?.trim() || undefined,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMISSION_CODES.AUDIT_LOG_VIEW)
  @ApiOperation({ summary: 'Get audit log details' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Audit log entry returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Audit log not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const logs =
      await this.prisma.client.orm.public.AuditLog.where({
        id,
      }).all();

    const log = logs[0];

    if (!log) {
      throw new NotFoundException('Audit log not found');
    }

    let metadata = log.metadata;
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch {
        // leave as-is
      }
    }

    return JSON.parse(
      JSON.stringify(
        { ...log, metadata },
        (_, v) =>
          typeof v === 'bigint' ? v.toString() : v,
      ),
    );
  }
}
