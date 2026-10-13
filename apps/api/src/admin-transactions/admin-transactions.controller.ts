import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { RequirePermissions } from '../rbac/rbac.decorator.js';
import { PERMISSION_CODES } from '../rbac/rbac.constants.js';
import { RbacGuard } from '../rbac/rbac.guard.js';

import { AdminTransactionsService } from './admin-transactions.service.js';
import { QueryAdminTransactionsDto } from './dto/query-admin-transactions.dto.js';

@ApiTags('Admin Transactions')
@ApiBearerAuth('access-token')
@Controller('admin/transactions')
@UseGuards(RbacGuard)
export class AdminTransactionsController {
  constructor(
    private readonly transactionsService: AdminTransactionsService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.TRANSACTION_VIEW)
  @ApiOperation({ summary: 'List transactions', description: 'Returns paginated financial transactions across all customers, with optional filtering.' })
  @ApiResponse({ status: 200, description: 'Paginated transaction list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  findAll(@Query() query: QueryAdminTransactionsDto) {
    return this.transactionsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSION_CODES.TRANSACTION_VIEW)
  @ApiOperation({ summary: 'Get transaction details' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Transaction detail returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.transactionsService.findOne(id);
  }
}
