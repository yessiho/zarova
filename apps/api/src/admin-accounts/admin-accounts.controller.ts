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

import { AdminAccountsService } from './admin-accounts.service.js';
import { QueryAdminAccountsDto } from './dto/query-admin-accounts.dto.js';
import { UpdateAdminAccountStatusDto } from './dto/update-admin-account-status.dto.js';

interface AdminRequest extends Request {
  user?: {
    id: number | string;
    type?: string;
  };
}

@ApiTags('Admin Accounts')
@ApiBearerAuth('access-token')
@Controller('admin/accounts')
@UseGuards(RbacGuard)
export class AdminAccountsController {
  constructor(
    private readonly accountsService: AdminAccountsService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.ACCOUNT_VIEW)
  @ApiOperation({ summary: 'List wallet accounts', description: 'Returns paginated customer wallet accounts with optional filters.' })
  @ApiResponse({ status: 200, description: 'Paginated accounts list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  findAll(@Query() query: QueryAdminAccountsDto) {
    return this.accountsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSION_CODES.ACCOUNT_VIEW)
  @ApiOperation({ summary: 'Get wallet account details', description: 'Returns full details for a single customer wallet account including balance and transaction history.' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Account details returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.accountsService.findOne(id);
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSION_CODES.ACCOUNT_SUSPEND)
  @ApiOperation({
    summary: 'Change wallet account status',
    description: 'Activates or suspends a customer wallet account. The action is audit-logged.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: UpdateAdminAccountStatusDto })
  @ApiResponse({ status: 200, description: 'Account status updated' })
  @ApiResponse({ status: 400, description: 'Invalid status value' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAdminAccountStatusDto,
    @Req() request: AdminRequest,
  ) {
    const adminId = Number(request.user?.id);

    return this.accountsService.updateStatus(
      id,
      body.status,
      adminId,
    );
  }
}
