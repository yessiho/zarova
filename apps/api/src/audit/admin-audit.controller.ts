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
    description:
      'Returns paginated audit logs with optional filters.',
  })
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
