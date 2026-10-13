import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
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
import { AdminLedgerService } from './admin-ledger.service.js';

@ApiTags('Admin Ledger')
@ApiBearerAuth('access-token')
@Controller('admin/ledger')
@UseGuards(RbacGuard)
export class AdminLedgerController {
  constructor(
    private readonly adminLedgerService: AdminLedgerService,
  ) {}

  @Get('accounts')
  @RequirePermissions(PERMISSION_CODES.LEDGER_VIEW)
  @ApiOperation({
    summary: 'List ledger accounts',
    description: 'Returns all double-entry ledger accounts with their current balances. Used to verify the chart of accounts.',
  })
  @ApiResponse({ status: 200, description: 'Ledger accounts list returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  findAll() {
    return this.adminLedgerService.findAll();
  }

  @Get('accounts/:id')
  @RequirePermissions(PERMISSION_CODES.LEDGER_VIEW)
  @ApiOperation({
    summary: 'Get ledger account details',
    description: 'Returns a single ledger account with its full entry history.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Ledger account detail returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Ledger account not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminLedgerService.findOne(id);
  }
}
